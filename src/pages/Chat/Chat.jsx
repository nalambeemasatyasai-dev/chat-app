import React, { useContext, useEffect, useState } from 'react'
import './Chat.css'
import LeftSidebar from '../../components/LeftSidebar/LeftSidebar'
import ChatBox from '../../components/ChatBox/ChatBox'
import RightSidebar from '../../components/RightSidebar/RightSidebar'
import { AppContext } from '../../context/AppContext'

const Chat = () => {

  const { chatData, userData, theme, setTheme } = useContext(AppContext);
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (chatData && userData) {
      setLoading(false);
    }
  }, [chatData,userData])

  useEffect(() => {
    if (!theme) {
      setTheme('light');
    }
  }, [theme, setTheme])

  return (
    <div className={`chat ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {loading
        ?<p className='loading'>
          Loading...
        </p>
        : <div className={`chat-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
          <LeftSidebar />
          <ChatBox />
          <RightSidebar />
        </div>
      }

    </div>
  )
}

export default Chat
