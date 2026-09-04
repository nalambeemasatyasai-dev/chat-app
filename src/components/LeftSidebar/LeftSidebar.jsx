import React, { useContext, useEffect, useState } from 'react'
import './LeftSidebar.css'
import assets from '../../assets/assets'
import { AppContext } from '../../context/AppContext';
import { toast } from 'react-toastify';
import { auth, db, logout } from '../../config/firebase';
import { arrayUnion, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const LeftSidebar = () => {

    const { chatData, userData, chatUser, setChatUser, setMessagesId, messagesId, chatVisible, setChatVisible, theme, toggleTheme } = useContext(AppContext);
    const [user, setUser] = useState(null);
    const [showSearch, setShowSearch] = useState(false)
    const navigate = useNavigate();

    const inputHandler = async (e) => {

        try {
            const input = e.target.value;

            if (input) {
                if (!auth.currentUser) return;
                setShowSearch(true);
                const userRef = collection(db, "users");
                const q = query(userRef, where("username", "==", input.toLowerCase()));
                const querySnap = await getDocs(q);
                if (!querySnap.empty && querySnap.docs[0].data().id !== userData.id) {
                    let userExist = false;
                    (chatData || []).map((user) => {
                        if (user.rId === querySnap.docs[0].data().id) {
                            userExist = true;
                        }
                    })
                    if (!userExist) {
                        setUser(querySnap.docs[0].data());
                    }
                }
                else {
                    setUser(null)
                }
            }
            else {
                setShowSearch(false);
            }
        } catch (error) {
            toast.error(error.message)
        }
    } 

    const addChat = async () => {
        const messagesRef = collection(db, "messages");
        const chatsRef = collection(db, "chats");
        try {
            if (!user) return;
            if (user.id === userData.id) {
                return 0
            }
            const newMessageRef = doc(messagesRef);

            await setDoc(newMessageRef, {
                createAt: serverTimestamp(),
                messages: []
            })  
 
            await updateDoc(doc(chatsRef, user.id), {
                chatsData: arrayUnion({
                    messageId: newMessageRef.id,
                    lastMessage: "",
                    rId: userData.id, 
                    updatedAt: Date.now(),
                    messageSeen: true
                }),
            });

            await updateDoc(doc(chatsRef, userData.id), {
                chatsData: arrayUnion({
                    messageId: newMessageRef.id,
                    lastMessage: "",
                    rId: user.id,
                    updatedAt: Date.now(),
                    messageSeen: true
                }),
            });

            const uSnap = await getDoc(doc(db, "users", user.id));
            if (!uSnap.exists()) return;
            const uData = uSnap.data();
            setChat({
                messageId: newMessageRef.id,
                lastMessage: "",
                rId: user.id,
                updatedAt: Date.now(),
                messageSeen: true,
                userData: uData,
            });
            setShowSearch(false)
            setChatVisible(true)
        } catch (error) {
            toast.error(error.message)
        }
    }

    const setChat = async (item) => {
        setMessagesId(item.messageId)
        setChatUser(item)
        const userChatsRef = doc(db, "chats", userData.id);
        const userChatsSnapshot = await getDoc(userChatsRef);
        if (!userChatsSnapshot.exists()) return;
        const userChatsData = userChatsSnapshot.data();
        const chatIndex = userChatsData.chatsData.findIndex((c) => c.messageId === item.messageId);
        if (chatIndex === -1) return;
        userChatsData.chatsData[chatIndex].messageSeen = true;
        await updateDoc(userChatsRef, {
            chatsData: userChatsData.chatsData,
        });
        setChatVisible(true)
    }

    useEffect(() => {
        const updateChatUserData = async () => {
            if (chatUser && auth.currentUser) {
                const userRef = doc(db, "users", chatUser.userData.id);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) return;
                const userData = userSnap.data();
                setChatUser(prev => ({ ...prev, userData: userData }))
            }
        }
        updateChatUserData();
    }, [chatData])


    return (
        <div className={`ls ${chatVisible ? "hidden" : ""}`}>
            <div className='ls-top'>
                <div className='ls-nav'>
                    <img className='logo' src={assets.logo} alt="Chat App Logo" />
                    <div className='ls-nav-actions'>
                        <button
                            type="button"
                            className="theme-toggle-btn"
                            onClick={toggleTheme}
                            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        <div className='menu'>
                            <img src={assets.menu_icon} alt="Menu" />
                            <div className='sub-menu'>
                                <p onClick={() => navigate('/profile')}>Edit Profile</p>
                                <hr />
                                <p onClick={toggleTheme}>{theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}</p>
                                <hr />
                                <p onClick={() => logout()}>Logout</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ls-search">
                    <img src={assets.search_icon} alt="" />
                    <input onChange={inputHandler} type="text" placeholder='Search here..' />
                </div>
            </div>
            <div className="ls-list">
                {showSearch ? (
                    user ? (
                        <div onClick={addChat} className='friends add-user'>
                            <div className="friends-avatar-wrap">
                                <img src={user.avatar} alt={user.name} />
                            </div>
                            <div className="friends-info">
                                <p className="friends-name">{user.name}</p>
                                <span className="friends-last-msg">Click to start conversation</span>
                            </div>
                        </div>
                    ) : (
                        <div className="ls-empty-search">No user found</div>
                    )
                ) : (
                    (chatData || []).map((item, index) => {
                        const isSelected = item.messageId === messagesId;
                        const isUnread = !item.messageSeen && !isSelected;
                        const isOnline = item.userData?.lastSeen && (Date.now() - item.userData.lastSeen <= 70000);

                        return (
                            <div
                                onClick={() => setChat(item)}
                                key={index}
                                className={`friends ${isSelected ? "active" : ""} ${isUnread ? "unread border" : ""}`}
                            >
                                <div className="friends-avatar-wrap">
                                    <img src={item.userData.avatar} alt={item.userData.name} />
                                    {isOnline && <span className="online-badge" title="Online"></span>}
                                </div>
                                <div className="friends-info">
                                    <div className="friends-header-row">
                                        <p className="friends-name">{item.userData.name}</p>
                                        {isUnread && <span className="unread-dot" title="Unread messages"></span>}
                                    </div>
                                    <span className="friends-last-msg">
                                        {item.lastMessage ? item.lastMessage.slice(0, 30) : "Start chatting"}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    )
}

export default LeftSidebar
