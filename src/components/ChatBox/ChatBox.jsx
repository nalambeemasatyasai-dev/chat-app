import React, { useContext, useEffect, useRef, useState } from 'react'
import './ChatBox.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext';
import { arrayUnion, doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { toast } from 'react-toastify';
import upload from '../../lib/upload';

const ChatBox = () => {


  const { userData, messagesId, chatUser, messages, setMessages, chatVisible, setChatVisible } = useContext(AppContext);
  const [input, setInput] = useState("");
  const [activeMenuIndex, setActiveMenuIndex] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const scrollEnd = useRef();

  // Synchronize server time offset to ensure the 15-minute window doesn't rely solely on the local clock
  useEffect(() => {
    const syncTime = async () => {
      try {
        const res = await fetch(window.location.href, { method: "HEAD", cache: "no-store" });
        const dateHeader = res.headers.get("date");
        if (dateHeader) {
          const serverMs = new Date(dateHeader).getTime();
          if (!isNaN(serverMs)) {
            setServerOffset(serverMs - Date.now());
          }
        }
      } catch {
        // Fallback: try Firebase Auth token timestamp
        try {
          if (auth.currentUser) {
            const tokenResult = await auth.currentUser.getIdTokenResult();
            if (tokenResult?.issuedAtTime) {
              const authMs = Date.parse(tokenResult.issuedAtTime);
              if (!isNaN(authMs)) {
                setServerOffset(authMs - Date.now());
              }
            }
          }
        } catch {
          // Default offset remains 0
        }
      }
    };
    syncTime();
  }, []);

  // Close dropdown menu when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.msg-menu-wrap')) {
        setActiveMenuIndex(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Listen to typing status of the active chat partner in real time
  useEffect(() => {
    if (!messagesId || !chatUser || !auth.currentUser) {
      setIsPartnerTyping(false);
      return;
    }

    const partnerId = chatUser.userData?.id || chatUser.rId;
    const typingDocRef = doc(db, "typing", messagesId);

    const unSub = onSnapshot(typingDocRef, (docSnap) => {
      if (!auth.currentUser) return;
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsPartnerTyping(Boolean(partnerId && data[partnerId]));
      } else {
        setIsPartnerTyping(false);
      }
    }, (err) => {
      console.error("Typing listener error:", err);
    });

    return () => {
      unSub();
      setIsPartnerTyping(false);
    };
  }, [messagesId, chatUser]);

  // Clean up current user's typing indicator when switching chats or unmounting
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingRef.current && messagesId && userData && auth.currentUser) {
        isTypingRef.current = false;
        setDoc(doc(db, "typing", messagesId), {
          [userData.id]: false
        }, { merge: true }).catch(() => {});
      }
    };
  }, [messagesId, userData]);

  const updateTypingStatus = async (status) => {
    if (!userData || !messagesId) return;
    try {
      await setDoc(doc(db, "typing", messagesId), {
        [userData.id]: status
      }, { merge: true });
    } catch (err) {
      console.error("Error updating typing status:", err);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    if (!messagesId || !userData) return;

    if (val.trim() === "") {
      // Empty input: immediately clear typing state
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (isTypingRef.current) {
        isTypingRef.current = false;
        updateTypingStatus(false);
      }
    } else {
      // Non-empty input: write true ONCE if not already typing
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        updateTypingStatus(true);
      }

      // Reset the 1.5-second inactivity timer on each keystroke (no new DB writes)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        updateTypingStatus(false);
        typingTimeoutRef.current = null;
      }, 1500);
    }
  };

  const getReliableTime = () => {
    return Date.now() + serverOffset;
  };

  const isWithin15Minutes = (createdAt) => {
    if (!createdAt) return false;
    let msgTime;
    if (typeof createdAt.toMillis === "function") {
      msgTime = createdAt.toMillis();
    } else if (createdAt.seconds !== undefined) {
      msgTime = createdAt.seconds * 1000;
    } else {
      msgTime = new Date(createdAt).getTime();
    }

    if (isNaN(msgTime)) return false;

    const now = getReliableTime();
    const diff = now - msgTime;

    // 15 minutes = 15 * 60 * 1000 = 900,000 ms
    return diff <= 15 * 60 * 1000;
  };

  const sendMessage = async () => {
    // Clear typing state immediately on message send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      updateTypingStatus(false);
    }

    try {

      if (input && messagesId) {
        await updateDoc(doc(db, "messages", messagesId), {
          messages: arrayUnion({
            id: Date.now() + "_" + Math.random().toString(36).substring(2, 9),
            sId: userData.id,
            text: input,
            createdAt: new Date()
          })
        })

        const userIDs = [chatUser.rId, userData.id];

        userIDs.forEach(async (id) => {
          const userChatsRef = doc(db, "chats", id);
          const userChatsSnapshot = await getDoc(userChatsRef);

          if (userChatsSnapshot.exists()) {
            const userChatsData = userChatsSnapshot.data();
            const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
            if (chatIndex === -1) return;
            userChatsData.chatsData[chatIndex].lastMessage = input;
            userChatsData.chatsData[chatIndex].updatedAt = Date.now();
            if (userChatsData.chatsData[chatIndex].rId == userData.id) {
              userChatsData.chatsData[chatIndex].messageSeen = false;
            }
            await updateDoc(userChatsRef, {
              chatsData: userChatsData.chatsData,
            });
          }
        })
      }

    } catch (error) {
      toast.error(error.message)
    }

    setInput("")

  }

  const convertTimestamp = (timestamp) => {
    if (!timestamp) return "";
    try {
      const date = typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
      let hour = date.getHours();
      const minute = date.getMinutes().toString().padStart(2, "0");
      const period = hour >= 12 ? "PM" : "AM";
      hour = hour % 12;
      if (hour === 0) {
        hour = 12;
      }
      return `${hour}:${minute} ${period}`;
    } catch {
      return "";
    }
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return "Offline";
    const diffMinutes = Math.floor((Date.now() - lastSeen) / 60000);
    if (diffMinutes < 2) return "Active recently";
    if (diffMinutes < 60) return `Last seen ${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;
    return "Offline";
  };

  const sendImage = async (e) => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      updateTypingStatus(false);
    }
    try {

      const fileUrl = await upload(e.target.files[0])

      if (fileUrl && messagesId) {
        await updateDoc(doc(db, "messages", messagesId), {
          messages: arrayUnion({
            id: Date.now() + "_" + Math.random().toString(36).substring(2, 9),
            sId: userData.id,
            image: fileUrl,
            createdAt: new Date()
          })
        })

        const userIDs = [chatUser.rId, userData.id];

        userIDs.forEach(async (id) => {
          const userChatsRef = doc(db, "chats", id);
          const userChatsSnapshot = await getDoc(userChatsRef);

          if (userChatsSnapshot.exists()) {
            const userChatsData = userChatsSnapshot.data();
            const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
            if (chatIndex === -1) return;
            userChatsData.chatsData[chatIndex].lastMessage = "Image";
            userChatsData.chatsData[chatIndex].updatedAt = Date.now();
            await updateDoc(userChatsRef, {
              chatsData: userChatsData.chatsData,
            });
          }
        })
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  const findMessageIndex = (allMessages, msg) => {
    const isMatch = (m1, m2) => {
      if (!m1 || !m2) return false;
      if (m1.sId !== m2.sId) return false;
      if (m1.id && m2.id) return m1.id === m2.id;

      const getTime = (t) => {
        if (!t) return null;
        if (typeof t.toMillis === "function") return t.toMillis();
        if (t.seconds !== undefined) return t.seconds * 1000;
        return new Date(t).getTime();
      };

      const t1 = getTime(m1.createdAt);
      const t2 = getTime(m2.createdAt);

      if (t1 && t2 && Math.abs(t1 - t2) < 3000) {
        if (m1.text && m2.text) return m1.text === m2.text;
        if (m1.image && m2.image) return m1.image === m2.image;
        return true;
      }
      return false;
    };

    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (isMatch(allMessages[i], msg)) {
        return i;
      }
    }
    return -1;
  };

  // Delete for Me: Hides the message only for the current user by appending user's ID to deletedFor
  const deleteForMe = async (msg) => {
    try {
      setActiveMenuIndex(null);

      if (!userData || !messagesId) return;

      const messageRef = doc(db, "messages", messagesId);
      const messageSnap = await getDoc(messageRef);

      if (!messageSnap.exists()) {
        toast.error("Message document not found");
        return;
      }

      const messageData = messageSnap.data();
      const allMessages = messageData.messages ? [...messageData.messages] : [];
      const targetIndex = findMessageIndex(allMessages, msg);

      if (targetIndex === -1) {
        toast.error("Message not found in database");
        return;
      }

      const currentDeletedFor = allMessages[targetIndex].deletedFor || [];
      if (!currentDeletedFor.includes(userData.id)) {
        allMessages[targetIndex] = {
          ...allMessages[targetIndex],
          deletedFor: [...currentDeletedFor, userData.id],
        };

        await updateDoc(messageRef, {
          messages: allMessages,
        });

        // If the deleted message was the last message, update the current user's sidebar preview
        if (targetIndex === allMessages.length - 1) {
          const userChatsRef = doc(db, "chats", userData.id);
          const userChatsSnapshot = await getDoc(userChatsRef);
          if (userChatsSnapshot.exists()) {
            const userChatsData = userChatsSnapshot.data();
            const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
            if (chatIndex !== -1) {
              let previousPreview = "";
              for (let i = allMessages.length - 2; i >= 0; i--) {
                const m = allMessages[i];
                if (!m.deletedFor || !m.deletedFor.includes(userData.id)) {
                  previousPreview = m.deleted ? "This message was deleted" : (m.text || (m.image ? "Image" : ""));
                  break;
                }
              }
              userChatsData.chatsData[chatIndex].lastMessage = previousPreview;
              await updateDoc(userChatsRef, {
                chatsData: userChatsData.chatsData,
              });
            }
          }
        }
      }

      toast.success("Message deleted for you");
    } catch (error) {
      console.error("Error in deleteForMe:", error);
      toast.error(error.message || "Failed to delete message");
    }
  };

  // Delete for Everyone: Available only to sender within 15 minutes of message creation
  const deleteForEveryone = async (msg) => {
    try {
      setActiveMenuIndex(null);

      // Security check 1: only the sender can delete for everyone
      if (!userData || msg.sId !== userData.id) {
        toast.error("You can only delete your own messages for everyone");
        return;
      }

      // Security check 2: 15-minute time window
      if (!isWithin15Minutes(msg.createdAt)) {
        toast.error("Delete for everyone is only available within 15 minutes of sending");
        return;
      }

      if (!messagesId) return;

      const messageRef = doc(db, "messages", messagesId);
      const messageSnap = await getDoc(messageRef);

      if (!messageSnap.exists()) {
        toast.error("Message document not found");
        return;
      }

      const messageData = messageSnap.data();
      const allMessages = messageData.messages ? [...messageData.messages] : [];
      const targetIndex = findMessageIndex(allMessages, msg);

      if (targetIndex === -1) {
        toast.error("Message not found in database");
        return;
      }

      // Verify document ownership
      if (allMessages[targetIndex].sId !== userData.id) {
        toast.error("Unauthorized: You can only delete your own messages");
        return;
      }

      // Verify 15-minute limit on document timestamp
      if (!isWithin15Minutes(allMessages[targetIndex].createdAt)) {
        toast.error("15-minute time limit for Delete for Everyone has expired");
        return;
      }

      // Soft delete: flag as deleted and clear content
      allMessages[targetIndex] = {
        ...allMessages[targetIndex],
        deleted: true,
        text: "",
        image: "",
        deletedAt: new Date(),
      };

      await updateDoc(messageRef, {
        messages: allMessages,
      });

      // Update lastMessage preview for both users in chats if this was the last message
      if (targetIndex === allMessages.length - 1) {
        const userIDs = [chatUser.rId, userData.id];
        userIDs.forEach(async (id) => {
          const userChatsRef = doc(db, "chats", id);
          const userChatsSnapshot = await getDoc(userChatsRef);
          if (userChatsSnapshot.exists()) {
            const userChatsData = userChatsSnapshot.data();
            const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === messagesId);
            if (chatIndex !== -1) {
              userChatsData.chatsData[chatIndex].lastMessage = "This message was deleted";
              userChatsData.chatsData[chatIndex].updatedAt = Date.now();
              await updateDoc(userChatsRef, {
                chatsData: userChatsData.chatsData,
              });
            }
          }
        });
      }

      toast.success("Message deleted for everyone");
    } catch (error) {
      console.error("Error in deleteForEveryone:", error);
      toast.error(error.message || "Failed to delete message");
    }
  };

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages])

  useEffect(() => {
    if (!messagesId || !auth.currentUser) return;
    setActiveMenuIndex(null);
    const unSub = onSnapshot(doc(db, "messages", messagesId), (res) => {
      if (!auth.currentUser) return;
      const data = res.data();
      if (!data || !data.messages) {
        setMessages([]);
        return;
      }
      setMessages([...data.messages].reverse());
    }, (err) => {
      console.error("Messages listener error:", err);
    });

    return () => {
      unSub();
    };

  }, [messagesId]);

  // Filter out messages deleted for the current user
  const visibleMessages = messages.filter(
    (msg) => !msg.deletedFor || !msg.deletedFor.includes(userData?.id)
  );

  const isPartnerOnline = Boolean(
    chatUser?.userData?.lastSeen && Date.now() - chatUser.userData.lastSeen <= 70000
  );

  return chatUser ? (
    <div className={`chat-box ${chatVisible ? "" : "hidden"}`}>
      <div className="chat-user">
        <button
          type="button"
          onClick={() => setChatVisible(false)}
          className="chat-back-btn arrow"
          title="Back to chats"
          aria-label="Back to chats"
        >
          <img src={assets.arrow_icon} alt="Back" />
        </button>

        <div className="chat-user-avatar-wrap">
          <img src={chatUser.userData.avatar} alt={chatUser.userData.name} />
          {isPartnerOnline && <span className="header-online-badge" title="Active now"></span>}
        </div>

        <div className="chat-user-details">
          <p className="chat-user-name">{chatUser.userData.name}</p>
        </div>

        <div className="chat-user-actions">
          <button type="button" className="chat-action-btn help" title="Chat details" aria-label="Chat details">
            <img src={assets.help_icon} alt="Help" />
          </button>
        </div>
      </div>

      <div className="chat-msg">
        <div ref={scrollEnd}></div>
        {
          visibleMessages.map((msg, index) => {
            const isOwner = msg.sId === userData?.id;
            const canDeleteEveryone = isOwner && !msg.deleted && isWithin15Minutes(msg.createdAt);

            return (
              <div key={msg.id || index} className={isOwner ? "s-msg" : "r-msg"}>
                <div className="msg-wrapper">
                  <div className="msg-menu-wrap">
                    <button
                      type="button"
                      className={`msg-menu-btn ${activeMenuIndex === index ? "active" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuIndex(activeMenuIndex === index ? null : index);
                      }}
                      title="Message options"
                      aria-label="Message options"
                    >
                      &#8942;
                    </button>
                    {activeMenuIndex === index && (
                      <div className="msg-dropdown">
                        <button
                          type="button"
                          className="msg-dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteForMe(msg);
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                            <circle cx="12" cy="7" r="4"></circle>
                          </svg>
                          Delete for me
                        </button>
                        {canDeleteEveryone && (
                          <button
                            type="button"
                            className="msg-dropdown-item danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteForEveryone(msg);
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete for everyone
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.deleted ? (
                    <p className="msg msg-deleted">
                      <svg className="deleted-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                      </svg>
                      <span>This message was deleted</span>
                    </p>
                  ) : msg["image"] ? (
                    <img onClick={() => window.open(msg["image"])} className='msg-img' src={msg["image"]} alt="" />
                  ) : (
                    <p className="msg">{msg["text"]}</p>
                  )}
                </div>
                <div className="msg-sender-info">
                  <img src={msg.sId === userData.id ? userData.avatar : chatUser.userData.avatar} alt="" />
                  <p>{convertTimestamp(msg.createdAt)}</p>
                </div>
              </div>
            )
          })
        }
      </div>

      {isPartnerTyping && (
        <div className="typing-indicator">
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <p>{chatUser?.userData?.name || chatUser?.userData?.username || "Someone"} is typing...</p>
        </div>
      )}

      <div className="chat-input">
        <div className="input-field-wrapper">
          <input
            onKeyDown={(e) => (e.key === "Enter" ? sendMessage() : null)}
            onChange={handleInputChange}
            value={input}
            type="text"
            placeholder="Type a message..."
          />
          <input onChange={sendImage} type="file" id="image" accept="image/png, image/jpeg" hidden />
          <label htmlFor="image" className="input-action-btn" title="Attach image" aria-label="Attach image">
            <img src={assets.gallery_icon} alt="Attach image" />
          </label>
        </div>
        <button
          type="button"
          onClick={sendMessage}
          className={`send-msg-btn ${input.trim() ? "has-text" : ""}`}
          title="Send message"
          aria-label="Send message"
        >
          <img src={assets.send_button} alt="Send" />
        </button>
      </div>
    </div>
  ) : (
    <div className={`chat-welcome ${chatVisible ? "" : "hidden"}`}>
      <div className="welcome-card">
        <div className="welcome-icon-wrap">
          <img src={assets.logo_icon} alt="Chat App" />
        </div>
        <h2>Welcome to Chat</h2>
        <p className="welcome-subtitle">Chat anytime, anywhere</p>
        <span className="welcome-hint">Select a conversation or search for users from the sidebar to begin messaging.</span>
      </div>
    </div>
  );
}

export default ChatBox;
