# 💬 Chat App

A modern real-time chat application built with **React.js, Vite, Firebase, and Cloudinary**. The application provides secure user authentication, real-time messaging, profile management, typing indicators, online status, and image sharing through a clean and responsive interface.

## 🚀 Live Demo

**Live Application:**  
https://chat-app-eb890.web.app

---

## ✨ Features

- 🔐 User registration and login
- 💬 Real-time one-to-one messaging
- ⚡ Real-time message updates using Firebase Firestore
- 👤 User profile management
- 🖼️ Profile image upload
- 📷 Image sharing in chats
- 🟢 Online/offline user status
- ⌨️ Real-time typing indicator
- 🔎 Search users
- 🗑️ Chat and message management
- 📱 Responsive user interface
- ☁️ Firebase Hosting deployment

---

## 🛠️ Tech Stack

### Frontend

- React.js
- Vite
- JavaScript
- HTML5
- CSS3

### Backend & Cloud Services

- Firebase Authentication
- Firebase Firestore
- Cloudinary
- Firebase Hosting

### Development Tools

- Git
- GitHub
- npm
- Firebase CLI
- Visual Studio Code

---

## 🏗️ Application Architecture

```text
                         ┌─────────────────┐
                         │      User       │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  React + Vite   │
                         │    Frontend     │
                         └────────┬────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
             ┌────────────┐ ┌────────────┐ ┌────────────┐
             │  Firebase  │ │  Firestore │ │ Cloudinary │
             │    Auth    │ │  Database  │ │   Images   │
             └────────────┘ └────────────┘ └────────────┘
