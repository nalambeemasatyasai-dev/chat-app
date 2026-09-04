import React, { useContext, useEffect, useState } from 'react'
import './RightSidebar.css'
import { logout } from '../../config/firebase'
import { AppContext } from '../../context/AppContext'

const RightSidebar = () => {

  const { chatUser, messages, userData } = useContext(AppContext);
  const [msgImages, setMsgImages] = useState([]);

  useEffect(() => {
    let tempVar = [];
    messages.forEach((msg) => {
      if (msg.image && !msg.deleted && (!msg.deletedFor || !msg.deletedFor.includes(userData?.id))) {
        tempVar.push(msg.image);
      }
    });
    setMsgImages(tempVar);
  }, [messages, userData]);

  const isOnline = Boolean(
    chatUser?.userData?.lastSeen && Date.now() - chatUser.userData.lastSeen <= 70000
  );

  return chatUser ? (
    <div className='rs'>
      <div className='rs-content'>
        <div className='rs-profile'>
          <div className="rs-avatar-wrap">
            <img src={chatUser.userData.avatar} alt={chatUser.userData.name} />
            {isOnline && <span className="rs-online-badge" title="Active now"></span>}
          </div>
          <h3>{chatUser.userData.name}</h3>
          <div className="rs-bio-card">
            <span className="rs-bio-title">About</span>
            <p className="rs-bio-text">{chatUser.userData.bio || "No bio available"}</p>
          </div>
        </div>

        <div className="rs-divider"></div>

        <div className="rs-media">
          <div className="rs-section-header">
            <span>Shared Media</span>
            <span className="rs-media-count">{msgImages.length}</span>
          </div>
          {msgImages.length > 0 ? (
            <div className="rs-media-grid">
              {msgImages.map((url, index) => (
                <div key={index} className="rs-media-item" onClick={() => window.open(url)}>
                  <img src={url} alt="Shared media attachment" />
                </div>
              ))}
            </div>
          ) : (
            <div className="rs-no-media">No media shared yet</div>
          )}
        </div>
      </div>

      <div className="rs-footer">
        <button type="button" className="rs-logout-btn" onClick={() => logout()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </div>
  ) : (
    <div className='rs rs-empty'>
      <div className="rs-content">
        {userData && (
          <div className="rs-profile">
            <div className="rs-avatar-wrap">
              <img src={userData.avatar} alt={userData.name} />
            </div>
            <h3>{userData.name}</h3>
            <div className="rs-bio-card">
              <span className="rs-bio-title">About</span>
              <p className="rs-bio-text">{userData.bio || "Available"}</p>
            </div>
          </div>
        )}
      </div>
      <div className="rs-footer">
        <button type="button" className="rs-logout-btn" onClick={() => logout()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </div>
  );
}

export default RightSidebar;
