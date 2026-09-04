import { doc, getDoc, onSnapshot, updateDoc } from "firebase/firestore";
import { createContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = (props) => {

    const [userData, setUserData] = useState(null);
    const [chatData, setChatData] = useState(null);
    const [messagesId, setMessagesId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [chatUser, setChatUser] = useState(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('chat_theme') || 'light';
    });

    useEffect(() => {
        localStorage.setItem('chat_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    const navigate = useNavigate();

    const loadUserData = async (uid) => {
        try {
            if (!auth.currentUser) return;
            const userRef = doc(db, "users", uid);
            let userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                // Brief pause in case a new signup is currently writing documents
                await new Promise((resolve) => setTimeout(resolve, 800));
                if (!auth.currentUser) return;
                userSnap = await getDoc(userRef);
            }

            if (!userSnap.exists()) {
                if (auth.currentUser && auth.currentUser.uid === uid) {
                    toast.error("User data not found.");
                }
                return;
            }

            const user = userSnap.data();

            setUserData(user);

            if (user.avatar && user.name) {
                navigate("/chat");
            } else {
                navigate("/profile");
            }

            if (auth.currentUser) {
                await updateDoc(userRef, {
                    lastSeen: Date.now(),
                });
            }

        } catch (error) {
            console.error("loadUserData error:", error);
            if (auth.currentUser) {
                toast.error(error.message);
            }
        }
    };

    // Update lastSeen every minute
    useEffect(() => {
        if (!userData || !auth.currentUser) return;

        const userRef = doc(db, "users", userData.id);

        const interval = setInterval(async () => {
            try {
                if (auth.currentUser) {
                    await updateDoc(userRef, {
                        lastSeen: Date.now(),
                    });
                }
            } catch (error) {
                console.log(error);
            }
        }, 60000);

        return () => clearInterval(interval);

    }, [userData]);

    // Listen for chat updates
    useEffect(() => {
        if (!userData || !auth.currentUser) return;

        const chatRef = doc(db, "chats", userData.id);

        const unSub = onSnapshot(chatRef, async (res) => {
            if (!auth.currentUser) return;
            const data = res.data();

            if (!data || !data.chatsData) {
                setChatData([]);
                return;
            }

            const chatItems = data.chatsData;
            const tempData = [];

            for (const item of chatItems) {
                if (!auth.currentUser) return;
                const userRef = doc(db, "users", item.rId);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) continue;

                const receiverData = userSnap.data();

                tempData.push({
                    ...item,
                    userData: receiverData,
                });
            }

            setChatData(
                tempData.sort((a, b) => b.updatedAt - a.updatedAt)
            );
        }, (error) => {
            console.error("Chat listener error:", error);
        });

        return () => {
            unSub();
        };

    }, [userData]);

    const value = {
        userData,
        setUserData,
        loadUserData,
        chatData,
        setChatData,
        messagesId,
        setMessagesId,
        chatUser,
        setChatUser,
        chatVisible,
        setChatVisible,
        messages,
        setMessages,
        theme,
        setTheme,
        toggleTheme,
    };

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContextProvider;