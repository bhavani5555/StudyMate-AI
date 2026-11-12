
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    deleteDoc,
    doc
  } from "firebase/firestore";
  
  import { auth, db } from "../firebase";
  
  // Save completed interview session to Firestore
  export const saveInterviewToCloud = async (interview) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to save your interview session.");
    }
  
    const interviewsRef = collection(
      db,
      "users",
      user.uid,
      "interviews"
    );
  
    const docRef = await addDoc(interviewsRef, interview);
  
    return {
      ...interview,
      id: docRef.id
    };
  };
  
  // Get all interview sessions from Firestore
  export const getCloudInterviews = async () => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to access your interview sessions.");
    }
  
    const interviewsRef = collection(
      db,
      "users",
      user.uid,
      "interviews"
    );
  
    const interviewsQuery = query(
      interviewsRef,
      orderBy("createdAt", "desc")
    );
  
    const snapshot = await getDocs(interviewsQuery);
  
    return snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data()
    }));
  };
  
  // Delete interview session from Firestore
  export const deleteCloudInterview = async (interviewId) => {
    const user = auth.currentUser;
  
    if (!user) {
      throw new Error("Please login to delete your interview session.");
    }
  
    const interviewRef = doc(
      db,
      "users",
      user.uid,
      "interviews",
      interviewId
    );
  
    await deleteDoc(interviewRef);
  };
  