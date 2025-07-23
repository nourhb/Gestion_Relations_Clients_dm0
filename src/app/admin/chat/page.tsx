
"use client";
export const dynamic = "force-dynamic";

import React, { Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  doc,
  getDoc,
  where
} from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { sendMessage } from "@/app/chat/actions"; // Re-use the existing action
import { fetchAdminChatSessions, type ChatSessionAdminListItem } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Send, UserCircle, Loader2, MessageSquare, Users, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import Image from 'next/image'; // For displaying chat images

const ADMIN_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1"; // Ensure this matches across app

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  senderName?: string;
  text: string;
  imageUrl?: string; // Added for images
  timestamp: Timestamp | null;
}

function AdminChatPageContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isClientPending, startClientTransition] = useTransition(); 
  const [isUploading, setIsUploading] = useState(false);

  const [chatSessions, setChatSessions] = useState<ChatSessionAdminListItem[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [selectedChat, setSelectedChat] = useState<ChatSessionAdminListItem | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialLoadDone = useRef(false);
  const originalTitle = useRef(typeof document !== 'undefined' ? document.title : 'Admin Chat');

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
        const notifTitle = `رسالة جديدة من ${message.senderName || 'عميل'}`;
        const notifBody = message.text ? message.text : "أرسل صورة.";
        
        new Notification(notifTitle, {
            body: notifBody,
            icon: "/logo.png",
        });
      }
  };


  useEffect(() => {
    if (!authLoading && (!user || user.uid !== ADMIN_UID)) {
      toast({ variant: "destructive", title: "غير مصرح به", description: "ليس لديك إذن لعرض هذه الصفحة." });
      router.push("/");
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    if (user && user.uid === ADMIN_UID) {
      setIsLoadingSessions(true);
      fetchAdminChatSessions(user.uid)
        .then((result) => {
          if (result.success && result.sessions) {
            setChatSessions(result.sessions);
          } else {
            toast({ variant: "destructive", title: "خطأ في تحميل المحادثات", description: result.error });
          }
        })
        .finally(() => setIsLoadingSessions(false));
    }
  }, [user, toast]);

  // Listener for messages of the selected chat
  useEffect(() => {
    if (!selectedChat?.chatId) {
      setMessages([]);
      return;
    }
    
    initialLoadDone.current = false;
    setIsLoadingMessages(true);
    const messagesQuery = query(
      collection(db, "chats", selectedChat.chatId, "messages"),
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
            // Don't notify if message is from myself (admin)
            if (user && lastMessage.senderId !== user.uid) {
                playNotificationSound();
                showNotification(lastMessage);
                document.title = `(1) رسالة جديدة! | ${originalTitle.current}`;
            }
        }
        
        setMessages(fetchedMessages);
        setIsLoadingMessages(false);
        // Mark initial load as done after the first fetch.
        setTimeout(() => {
            initialLoadDone.current = true;
        }, 500);
      },
      (error) => {
        console.error("Error fetching messages for admin:", error);
        toast({
          variant: "destructive",
          title: "خطأ في تحميل الرسائل",
          description: error.message,
        });
        setIsLoadingMessages(false);
      }
    );
    return () => unsubscribe();
  }, [selectedChat, toast, user, messages.length]);

  // Effect to reset page title when window is focused
    useEffect(() => {
        const handleFocus = () => {
            document.title = originalTitle.current;
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);


  // Scroll to bottom
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
    if (!newMessage.trim() || !user || !selectedChat?.clientUid) return;

    const senderName = "DigitalMen0 دعم";

    const textToSend = newMessage;
    setNewMessage(""); 

    startClientTransition(async () => {
      // Admin (user) sends to client (selectedChat.clientUid)
      const result = await sendMessage(user.uid, selectedChat.clientUid, senderName, textToSend, undefined); 
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
    if (!user || !selectedChat?.clientUid || !selectedChat?.chatId) {
        toast({ variant: "destructive", title: "خطأ", description: "لا يمكن إرسال صورة بدون جلسة محادثة نشطة." });
        return;
    }

    const file = event.target.files[0];
    const senderName = "DigitalMen0 دعم";

    if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
    
    setIsUploading(true);
    const toastId = "admin-upload-toast";
    toast({ id: toastId, title: "جاري تحميل الصورة...", description: "يرجى الانتظار."});

    try {
      const uniqueFileName = `${Date.now()}_${file.name}`;
      // Admin (user.uid) is sending image to client (selectedChat.clientUid) in chat (selectedChat.chatId)
      const imageRef = storageRef(storage, `chat_images/${selectedChat.chatId}/${user.uid}/${uniqueFileName}`);
      
      const uploadTask = uploadBytesResumable(imageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Optional: Update toast with progress
        },
        (error) => {
          console.error("Admin upload failed:", error);
          toast.dismiss(toastId);
          toast({ variant: "destructive", title: "فشل التحميل", description: error.message });
          setIsUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          toast.dismiss(toastId);
          toast({ title: "تم إرسال الصورة!", description: "تم تحميل الصورة وإرسالها إلى العميل." });
          
          startClientTransition(async () => {
            // Send message with image URL to the selected client
            const result = await sendMessage(user.uid, selectedChat.clientUid, senderName, undefined, downloadURL);
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
    if (!name || name.startsWith("زائر")) return "ز";
    const names = name.split(' ');
    if (names.length > 1 && names[0] && names[names.length - 1]) {
      return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
    }
    if (name?.length > 0) return name[0].toUpperCase();
    return "ع";
  };

  if (authLoading || !user) {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" preload="auto"></audio>
      <div className="container mx-auto px-0 py-4 flex flex-row h-[calc(100vh-8rem)] gap-4">
        {/* Sidebar for Chat Sessions */}
        <Card className="w-1/3 lg:w-1/4 flex flex-col shadow-lg">
          <CardHeader className="border-b">
            <CardTitle className="text-xl flex items-center"><Users className="mr-2 rtl:ml-2 rtl:mr-0 h-6 w-6 text-primary" /> محادثات العملاء</CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <ScrollArea className="h-full">
              {isLoadingSessions && <div className="p-4 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}
              {!isLoadingSessions && chatSessions.length === 0 && (
                <p className="p-4 text-center text-muted-foreground">لا توجد جلسات محادثة نشطة.</p>
              )}
              <div className="space-y-0">
                {chatSessions.map(session => (
                  <Button
                    key={session.chatId}
                    variant={selectedChat?.chatId === session.chatId ? "secondary" : "ghost"}
                    className="w-full justify-start h-auto p-3 rounded-none border-b"
                    onClick={() => setSelectedChat(session)}
                  >
                    <Avatar className="h-10 w-10 mr-3 rtl:ml-3 rtl:mr-0">
                      <AvatarFallback className="bg-muted text-muted-foreground">
                          {getInitials(session.clientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-right rtl:text-left overflow-hidden">
                      <p className="font-semibold truncate">{session.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.lastMessageText}</p>
                    </div>
                    {session.lastMessageTimestamp && (
                      <p className="text-xs text-muted-foreground ml-2 rtl:mr-2 rtl:ml-0 self-start shrink-0">
                          {formatDistanceToNowStrict(parseISO(session.lastMessageTimestamp), { addSuffix: true, locale: arSA })}
                      </p>
                    )}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col shadow-lg">
          {!selectedChat ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8">
              <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-muted-foreground">اختر محادثة لبدء المراسلة</p>
              <p className="text-sm text-muted-foreground">ستظهر محادثاتك مع العملاء هنا.</p>
            </div>
          ) : (
            <>
              <CardHeader className="border-b">
                <CardTitle className="text-xl text-primary flex items-center">
                  <UserCircle className="mr-2 rtl:ml-2 rtl:mr-0 h-6 w-6" />
                  محادثة مع {selectedChat.clientName}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
                  {isLoadingMessages && (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                  {!isLoadingMessages && messages.length === 0 && (
                    <p className="text-center text-muted-foreground py-10">لا توجد رسائل بعد.</p>
                  )}
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex items-end space-x-2 rtl:space-x-reverse",
                          msg.senderId === user.uid ? "justify-end" : "justify-start"
                        )}
                      >
                        {msg.senderId !== user.uid && (
                          <Avatar className="h-8 w-8 self-start">
                            <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                              {getInitials(msg.senderName || selectedChat.clientName)}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={cn(
                            "max-w-[70%] rounded-lg px-3 py-2 text-sm shadow break-words",
                            msg.senderId === user.uid
                              ? "bg-primary text-primary-foreground rounded-br-none rtl:rounded-bl-none rtl:rounded-br-lg"
                              : "bg-muted text-foreground rounded-bl-none rtl:rounded-br-none rtl:rounded-bl-lg"
                          )}
                        >
                          {msg.senderName && msg.senderId !== user.uid && (
                            <p className={cn(
                              "font-bold text-xs mb-1",
                              "text-primary"
                            )}>
                              {msg.senderName}
                            </p>
                          )}
                          {msg.imageUrl ? (
                              <Image src={msg.imageUrl} alt="Chat image" width={200} height={200} className="rounded-md my-1 max-w-full h-auto" />
                          ) : null}
                          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
                          {msg.timestamp && (
                            <p className={cn(
                              "text-xs mt-1",
                              msg.senderId === user.uid ? "text-primary-foreground/70 text-right" : "text-muted-foreground/70 text-left"
                            )}>
                              {msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                        {msg.senderId === user.uid && (
                          <Avatar className="h-8 w-8 self-start">
                            <AvatarFallback className="bg-primary/20 text-primary text-xs">
                              مد
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="border-t pt-4">
                <form onSubmit={handleSendMessage} className="flex w-full items-center space-x-2 rtl:space-x-reverse">
                  <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isClientPending || isUploading}>
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
                    disabled={isClientPending || isUploading}
                  />
                  <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isClientPending || isUploading || !newMessage.trim()}>
                    {isClientPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="sr-only">إرسال</span>
                  </Button>
                </form>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </>
  );
}

export default function AdminChatPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminChatPageContent />
    </Suspense>
  );
}
