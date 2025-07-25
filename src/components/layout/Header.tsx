
"use client"; 

import * as React from "react"; 
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'; 
import { Menu, UserCircle, LogOut, Settings, ListChecks, MessageSquare, CalendarClock, CalendarDays } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { useAuth } from '@/context/AuthContext'; 

const SERVICE_PROVIDER_UID = "eQwXAu9jw7cL0YtMHA3WuQznKfg1"; // Admin/Provider UID

export default function Header() {
  const { user, loading, logout } = useAuth();
  const isAdmin = user?.uid === SERVICE_PROVIDER_UID;

  const baseNavItems = [
    { href: '/', label: 'الرئيسية' },
    { href: '/request', label: 'طلب خدمة' },
    { href: '/chat', label: 'المحادثة', icon: <MessageSquare className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" /> },
    { href: '/meeting', label: 'جلسات الفيديو' }, 
  ];

  const adminNavItems = isAdmin ? [
    { href: '/admin/requests', label: 'إدارة الطلبات', icon: <ListChecks className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" /> },
    { href: '/admin/availability-template', label: 'الجدول الأسبوعي', icon: <CalendarClock className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" /> },
    { href: '/admin/availability', label: 'الاستثناءات اليومية', icon: <CalendarDays className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" /> },
    { href: '/admin/chat', label: 'محادثات العملاء', icon: <MessageSquare className="ml-2 h-4 w-4 rtl:mr-2 rtl:ml-0" /> }
  ] : [];
  
  const allNavItemsForMobile = [...baseNavItems.filter(item => !isAdmin || !['/chat'].includes(item.href)), ...adminNavItems];


  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2 rtl:ml-6 rtl:mr-0">
          <span className="font-bold text-xl text-primary">DigitalMen0</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden flex-1 items-center space-x-4 rtl:space-x-reverse md:flex">
          {!isAdmin && baseNavItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
          {isAdmin && adminNavItems.map((item) => (
            <Button key={item.href} variant="ghost" asChild>
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2 rtl:space-x-reverse">
          {/* Desktop Auth Links / User Info */}
          <div className="hidden md:flex items-center space-x-2 rtl:space-x-reverse">
            {loading && (
              <Button variant="ghost" size="icon" disabled>
                <div className="h-5 w-5 rounded-full border-2 border-border border-t-primary animate-spin" />
              </Button>
            )}
            {!loading && user && (
              <>
                <Button variant="ghost" size="icon" onClick={logout} title="تسجيل الخروج">
                  <LogOut className="h-5 w-5" />
                </Button>
              </>
            )}
            <ModeToggle />
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">تبديل القائمة</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <SheetHeader className="text-left">
                  <SheetTitle className="sr-only">القائمة</SheetTitle>
                  <SheetDescription className="sr-only">التنقل الرئيسي والخيارات</SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col space-y-2 pt-6">
                  {allNavItemsForMobile.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <Button variant="ghost" className="justify-start text-lg" asChild>
                        <Link href={item.href} className="flex items-center w-full">
                           {item.label} {item.icon && React.cloneElement(item.icon as React.ReactElement, {className: "mr-auto rtl:ml-auto rtl:mr-0 h-5 w-5"})}
                        </Link>
                      </Button>
                    </SheetClose>
                  ))}
                  {!loading && user && (
                     <SheetClose asChild>
                        <Button variant="ghost" onClick={logout} className="justify-start text-lg text-destructive hover:text-destructive-foreground hover:bg-destructive/90 w-full">
                            تسجيل الخروج <LogOut className="mr-auto rtl:ml-auto rtl:mr-0 h-5 w-5" />
                        </Button>
                     </SheetClose>
                  )}
                  <div className="pt-4 border-t border-border/40">
                     <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">تغيير السمة</span>
                        <ModeToggle />
                    </div>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
