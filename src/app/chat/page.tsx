
"use client";
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useTransition, useCallback } from "react";
import { db, storage, isFirebaseConfigured } from "@/lib/firebase"; 
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { sendMessage } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Send, UserCircle, Loader2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Image from 'next/image';

const ADMIN_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1";
const ADMIN_DISPLAY_NAME = "DigitalMen0 دعم"; 

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  text: string;
  imageUrl?: string;
  timestamp: Timestamp | null;
}

const getChatId = (uid1: string, uid2: string): string => {
  const ids = [uid1, uid2].sort();
  return ids.join("_");
};

const generateAnonymousId = () => {
    // A simple way to generate a random ID
    return 'anon_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};


export default function ChatPage() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [anonymousId, setAnonymousId] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialLoadDone = useRef(false);
  const originalTitle = useRef(typeof document !== 'undefined' ? document.title : 'Chat');

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.error("Error playing sound:", e));
    }
  };

  const showNotification = (message: Message) => {
      if ("Notification" in window && Notification.permission === "granted") {
        const notifTitle = `رسالة جديدة من ${message.senderName || 'الدعم'}`;
        const notifBody = message.text ? message.text : "أرسل صورة.";
        
        new Notification(notifTitle, {
            body: notifBody,
            icon: "/logo.png",
        });
      }
  };


  useEffect(() => {
    let currentId = localStorage.getItem('anonymousChatId');
    if (!currentId) {
      currentId = generateAnonymousId();
      localStorage.setItem('anonymousChatId', currentId);
    }
    setAnonymousId(currentId);
    setIsLoading(false);
  }, []);


  useEffect(() => {
    if (anonymousId) {
      const currentChatId = getChatId(anonymousId, ADMIN_UID);
      setChatId(currentChatId);
    }
  }, [anonymousId]);

  useEffect(() => {
    if (!chatId || !isFirebaseConfigured) {
      if (!isFirebaseConfigured) setIsLoading(false);
      return;
    }
    
    initialLoadDone.current = false;
    setIsLoading(true);
    const messagesQuery = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(
      messagesQuery,
      (querySnapshot) => {
        const fetchedMessages: Message[] = [];
        querySnapshot.forEach((doc) => {
          fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
        });
        
        if (initialLoadDone.current && fetchedMessages.length > messages.length) {
            const lastMessage = fetchedMessages[fetchedMessages.length - 1];
            // Don't notify if message is from myself (client)
            if (anonymousId && lastMessage.senderId !== anonymousId) {
                playNotificationSound();
                showNotification(lastMessage);
                document.title = `(1) رسالة جديدة! | ${originalTitle.current}`;
            }
        }

        setMessages(fetchedMessages);
        setIsLoading(false);
        // Mark initial load as done after the first fetch.
        setTimeout(() => {
            initialLoadDone.current = true;
        }, 500);
      },
      (error) => {
        console.error("Error fetching messages:", error);
        toast({
          variant: "destructive",
          title: "خطأ في تحميل الرسائل",
          description: error.message,
        });
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [chatId, toast, anonymousId, messages.length]);

  // Effect to reset page title when window is focused
    useEffect(() => {
        const handleFocus = () => {
            document.title = originalTitle.current;
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);


  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [messages]);


  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!newMessage.trim() || !anonymousId || !chatId) return;

    const senderId = anonymousId;
    const senderName = `زائر ${anonymousId.substring(5, 11)}`; // e.g., "زائر a1b2c3"

    const textToSend = newMessage;
    setNewMessage("");

    startTransition(async () => {
      const result = await sendMessage(senderId, ADMIN_UID, senderName, textToSend, undefined); 
      if (!result.success) {
        toast({
          variant: "destructive",
          title: "لم يتم إرسال الرسالة",
          description: result.error || "تعذر إرسال رسالتك.",
        });
        setNewMessage(textToSend);
      }
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    if (!anonymousId || !chatId) {
        toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إرسال صورة بدون جلسة محادثة نشطة." });
        return;
    }
    const file = event.target.files[0];
    const senderId = anonymousId;
    const senderName = `زائر ${anonymousId.substring(5, 11)}`;
    if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input early

    setIsUploading(true);
    const toastId = "upload-toast";
    toast({ id: toastId, title: "جاري تحميل الصورة...", description: "يرجى الانتظار." });

    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      const imageRef = storageRef(storage, `chat_images/${chatId}/${senderId}/${uniqueFileName}`);
      
      const uploadTask = uploadBytesResumable(imageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Can update toast with progress if desired
        },
        (error) => {
          console.error("Upload failed:", error);
          toast.dismiss(toastId);
          toast({ variant: "destructive", title: "فشل التحميل", description: error.message });
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          toast.dismiss(toastId);
          toast({ title: "تم إرسال الصورة!", description: "تم تحميل صورتك وإرسالها." });
          
          startTransition(async () => {
            const result = await sendMessage(senderId, ADMIN_UID, senderName, undefined, downloadURL); 
            if (!result.success) {
              toast({ variant: "destructive", title: "لم يتم إرسال الرسالة (صورة)", description: result.error });
            }
          });
          setIsUploading(false);
        }
      );
    } catch (error: any) {
      toast.dismiss(toastId);
      toast({ variant: "destructive", title: "خطأ في التحميل", description: error.message || "حدث خطأ غير متوقع أثناء التحميل." });
      setIsUploading(false);
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "ز";
    if(name.startsWith(ADMIN_DISPLAY_NAME)) return "دع";
    return "ز";
  };


  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 rtl:mr-3 text-lg">جاري تهيئة المحادثة...</p>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" preload="auto"></audio>
      <div className="container mx-auto px-2 py-6 md:px-4 md:py-8 flex flex-col h-[calc(100vh-10rem)] max-w-3xl">
        <Card className="flex flex-col flex-1 shadow-xl">
          <CardHeader className="border-b">
            <CardTitle className="text-xl text-primary flex items-center">
              <UserCircle className="mr-2 rtl:ml-2 rtl:mr-0 h-6 w-6" />
              محادثة مع {ADMIN_DISPLAY_NAME}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              {isLoading && (
                <div className="flex justify-center items-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="ml-2 rtl:mr-2 rtl:ml-0 text-muted-foreground">جاري تحميل الرسائل...</p>
                </div>
              )}
              {!isLoading && messages.length === 0 && (
                <p className="text-center text-muted-foreground py-10">
                  لا توجد رسائل بعد. ابدأ المحادثة!
                </p>
              )}
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex items-end space-x-2 rtl:space-x-reverse",
                      msg.senderId === anonymousId ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.senderId !== anonymousId && (
                      <Avatar className="h-8 w-8 self-start">
                        <AvatarFallback className="bg-primary/20 text-primary text-xs">
                          دع
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[70%] rounded-lg px-3 py-2 text-sm shadow break-words",
                        msg.senderId === anonymousId
                          ? "bg-primary text-primary-foreground rounded-br-none rtl:rounded-bl-none rtl:rounded-br-lg"
                          : "bg-muted text-foreground rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-lg"
                      )}
                    >
                      {msg.senderName && msg.senderId !== anonymousId && (
                        <p className={cn(
                          "font-bold text-xs mb-1",
                          "text-primary"
                        )}>
                          {msg.senderName}
                        </p>
                      )}
                      {msg.imageUrl ? (
                          <Image src={msg.imageUrl} alt="Chat image" width={200} height={200} className="rounded-md my-1 max-w-full h-auto" data-ai-hint="chat message image" />
                      ) : null}
                      {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                      {msg.timestamp && (
                        <p className={cn(
                          "text-xs mt-1",
                          msg.senderId === anonymousId ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70 text-left"
                          )}>
                          {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    {msg.senderId === anonymousId && (
                      <Avatar className="h-8 w-8 self-start">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          ز
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          {chatId && (
            <CardFooter className="border-t pt-4">
              <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 rtl:space-x-reverse">
                <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isPending || isUploading}>
                    {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                    <span className="sr-only">إرسال صورة</span>
                  </Button>
                  <Input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    accept="image/*"
                    disabled={isUploading}
                  />
                <Input
                  type="text"
                  placeholder="اكتب رسالتك..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  disabled={isPending || isUploading}
                />
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isPending || isUploading || !newMessage.trim()}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="sr-only">إرسال</span>
                </Button>
              </form>
            </CardFooter>
          )}
        </Card>
      </div>
    </>
  );
}
