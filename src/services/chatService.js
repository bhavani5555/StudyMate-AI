
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    updateDoc,
    deleteDoc,
    doc
  } from "firebase/firestore";
  
  import { auth, db } from "../firebase";
  
  // Get the logged-in user's chat collection
  const getChatCollection = () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access your conversations.");
    }
  
    return collection(db, "users", user.uid, "chats");
  };
  
  // Save a new conversation
  export const saveChatToCloud = async (chat) => {
    const chatsRef = getChatCollection();
  
    const { id, ...chatData } = chat;
  
    const docRef = await addDoc(chatsRef, chatData);
  
    return {
      ...chatData,
      id: docRef.id
    };
  };
  
  // Fetch all conversations
  export const getCloudChats = async () => {
    const chatsRef = getChatCollection();
  
    const chatsQuery = query(
      chatsRef,
      orderBy("updatedAt", "desc")
    );
  
    const snapshot = await getDocs(chatsQuery);
  
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));
  };
  
  // Update an existing conversation
  export const updateCloudChat = async (chatId, updates) => {
    const chatsRef = getChatCollection();
  
    const chatRef = doc(chatsRef, chatId);
  
    await updateDoc(chatRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  };
  
  // Delete a conversation
  export const deleteCloudChat = async (chatId) => {
    const chatsRef = getChatCollection();
  
    const chatRef = doc(chatsRef, chatId);
  
    await deleteDoc(chatRef);
  };
  