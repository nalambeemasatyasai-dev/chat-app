import { initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, deleteUser, getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'
import { toast } from "react-toastify";

// --------- Paste Your Firebase Config File Here ---------


const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "YOUR_FIREBASE_APP_ID",
  measurementId: "YOUR_FIREBASE_MEASUREMENT_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app)
const db = getFirestore(app)

const signup = async (username, email, password) => {
    try {
        const cleanUsername = username ? username.trim().toLowerCase() : "";
        if (!cleanUsername) {
            toast.error("Please enter a username");
            return 0;
        }

        // 1. Create Firebase Auth user first so request.auth != null in Firestore rules
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const user = res.user;

        // 2. Query username uniqueness with the authenticated session
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where("username", "==", cleanUsername));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.docs.length > 0) {
            // Username is already taken: delete the newly created Auth account to roll back
            try {
                if (typeof user.delete === "function") {
                    await user.delete();
                } else {
                    await deleteUser(user);
                }
            } catch (delErr) {
                console.error("Failed to delete user after duplicate username check:", delErr);
            }
            toast.error("Username already taken");
            return 0;
        }

        // 3. Write user profile and chat data documents
        await setDoc(doc(db, "users", user.uid), {
            id: user.uid,
            username: cleanUsername,
            email,
            name: "",
            avatar: "",
            bio: "Hey, There i am using chat app",
            lastSeen: Date.now()
        });
        await setDoc(doc(db, "chats", user.uid), {
            chatsData: []
        });

        return user;
    } catch (error) {
        console.error("Signup error:", error);
        toast.error(error.message || "Signup failed");
    }
}

const login = async (email, password) => {
    try {
        await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
    console.error("Login error:", error)
    toast.error(error.message || "Login failed")
}
}

const logout = async () => {
    try {
        await signOut(auth)
    } catch (error) {
        console.error(error)
        toast.error(error.message)
    }
}

const resetPass = async (email) => {
    if (!email) {
        toast.error("Enter your email");
        return null;
    }
    try {
        await sendPasswordResetEmail(auth, email);
        toast.success("Reset Email Sent");
    } catch (error) {
        console.error("Reset password error:", error);
        if (error.code === "auth/user-not-found") {
            toast.error("Email doesn't exist");
        } else if (error.code === "auth/invalid-email") {
            toast.error("Invalid email address");
        } else {
            toast.error(error.message || "Failed to send reset email");
        }
    }
}

export { auth, db, login, signup, logout, resetPass};