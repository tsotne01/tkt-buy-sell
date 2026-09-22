import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Ticket, Calendar, MapPin, Search, ShieldCheck, 
  Clock, CheckCircle2, AlertCircle, ArrowRight, 
  RefreshCw, LogIn, LogOut, User, Lock, Mail, Sparkles,
  Eye, EyeOff, UserPlus, CreditCard, ChevronRight, Check, X, 
  Shield, Smartphone, QrCode, Download, Info, Building, 
  ArrowUpRight, Music, Trophy, Film, PartyPopper, HeartHandshake,
  Layers, CheckCircle
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './components/ui/card';
import { Input } from './components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Avatar } from './components/ui/avatar';
import { Separator } from './components/ui/separator';
import { cn } from './lib/utils';

interface EventItem {
  id: string;
  title: string;
  description: string;
  category: string;
  venue_name: string;
  city: string;
  date: string;
  min_price: number;
  available_seats: number;
  image_url: string;
}

interface TicketItem {
  id: string;
  event_id: string;
  section: string;
  row: string;
  seat_number: number;
  price: number;
  status: 'AVAILABLE' | 'HELD' | 'SOLD';
  is_resale: boolean;
  seller_id?: string;
  held_by_user_id?: string;
  hold_expires_at?: number;
}

interface OrderItem {
  id: string;
  ticket_id: string;
  event_id: string;
  event_title: string;
  seat_info: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  qr_code?: string;
  created_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'BUYER' | 'SELLER' | string;
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'events' | 'resale' | 'my-tickets'>('events');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [searchMeta, setSearchMeta] = useState<{ tookMs?: number; total: number; isSearching: boolean }>({
    total: 1000000,
    isSearching: false,
  });

  // Authentication State
  const [token, setToken] = useState<string>(() => localStorage.getItem('tkt_token') || '');
  const [activeUser, setActiveUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('tkt_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return {
      id: '',
      email: '',
      name: 'Guest Fan',
      role: 'GUEST',
    };
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'BUYER' });
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState<boolean>(false);

  // Secondary Resale Marketplace State
  const [resaleTickets, setResaleTickets] = useState<TicketItem[]>([]);
  const [isLoadingResale, setIsLoadingResale] = useState<boolean>(false);

  // WebSocket Live Sync State
  const [socket, setSocket] = useState<Socket | null>(null);

  // Events & Tickets state
  const [events, setEvents] = useState<EventItem[]>([
    {
      id: 'evt_1',
      title: 'Coldplay - Music of the Spheres World Tour',
      description: 'Experience Coldplay live in concert with an immersive stadium light spectacle and world-class sound.',
      category: 'Concerts',
      venue_name: 'Wembley Stadium',
      city: 'London',
      date: '2026-10-15T19:30:00Z',
      min_price: 85.0,
      available_seats: 55,
      image_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'evt_2',
      title: 'UEFA Champions League Final 2026',
      description: 'The pinnacle of European football. Witness two legendary clubs compete for the continental championship.',
      category: 'Sports',
      venue_name: 'Wembley Stadium',
      city: 'London',
      date: '2026-11-28T20:00:00Z',
      min_price: 150.0,
      available_seats: 120,
      image_url: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'evt_3',
      title: 'Hans Zimmer Live - The World Tour',
      description: 'The Oscar-winning master performs iconic suites from Interstellar, Dune, Inception, and Gladiator.',
      category: 'Concerts',
      venue_name: 'Madison Square Garden',
      city: 'New York',
      date: '2026-12-05T19:00:00Z',
      min_price: 95.0,
      available_seats: 250,
      image_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'evt_4',
      title: 'Hamilton - The Musical Drama',
      description: 'Lin-Manuel Miranda’s Pulitzer-winning phenomenon chronicling America then as told by America now.',
      category: 'Theater',
      venue_name: 'Staples Center',
      city: 'Los Angeles',
      date: '2026-10-22T20:00:00Z',
      min_price: 70.0,
      available_seats: 195,
      image_url: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&w=1200&q=80',
    },
  ]);

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [heldTicket, setHeldTicket] = useState<TicketItem | null>(null);
  const [holdTimeRemaining, setHoldTimeRemaining] = useState<number>(600);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState<boolean>(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState<boolean>(false);

  // Payment Form State
  const [checkoutForm, setCheckoutForm] = useState({
    cardNumber: '4242 •••• •••• 4242',
    cardExpiry: '12/28',
    cardCvc: '888',
    cardName: 'Alex Morgan',
    simulateDecline: false,
  });

  // Resale modal state
  const [resaleModalTicket, setResaleModalTicket] = useState<OrderItem | null>(null);
  const [resalePriceInput, setResalePriceInput] = useState<string>('120');

  // Toasts
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // Real Auth Handlers
  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || data.error_message || 'Invalid credentials');
        setAuthLoading(false);
        return false;
      }
      const user: UserProfile = {
        id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
      };
      setToken(data.token);
      setActiveUser(user);
      localStorage.setItem('tkt_token', data.token);
      localStorage.setItem('tkt_user', JSON.stringify(user));
      setIsAuthModalOpen(false);
      setAuthLoading(false);
      addToast('success', 'Welcome Back', `Signed in as ${user.name}`);
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Connection failed');
      setAuthLoading(false);
      return false;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || data.error_message || 'Registration failed');
        setAuthLoading(false);
        return;
      }
      const user: UserProfile = {
        id: data.user_id,
        email: data.email,
        name: data.name,
        role: data.role,
      };
      setToken(data.token);
      setActiveUser(user);
      localStorage.setItem('tkt_token', data.token);
      localStorage.setItem('tkt_user', JSON.stringify(user));
      setIsAuthModalOpen(false);
      setAuthLoading(false);
      addToast('success', 'Account Created', `Welcome to TicketHub, ${user.name}!`);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('tkt_token');
    localStorage.removeItem('tkt_user');
    setActiveUser({
      id: 'usr_guest',
      email: 'guest@example.com',
      name: 'Guest Fan',
      role: 'GUEST',
    });
    setIsUserMenuOpen(false);
    addToast('info', 'Signed Out', 'You have been signed out successfully.');
  };

  // Load secondary resale tickets from backend
  const loadResaleTickets = async () => {
    setIsLoadingResale(true);
    try {
      const res = await fetch('/api/inventory/resale');
      const data = await res.json();
      if (data && Array.isArray(data.tickets)) {
        setResaleTickets(data.tickets);
      }
    } catch (err) {
      console.error('Failed to load resale tickets', err);
    } finally {
      setIsLoadingResale(false);
    }
  };

  useEffect(() => {
    loadResaleTickets();
  }, []);

  // Debounced search query
  useEffect(() => {
    const timer = setTimeout(async () => {
      setSearchMeta((prev) => ({ ...prev, isSearching: true }));
      const startTime = performance.now();
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.append('search', searchQuery.trim());
        if (selectedCategory && selectedCategory !== 'All') params.append('category', selectedCategory);

        const res = await fetch(`/api/events?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events)) {
            setEvents(data.events);
            const took = Math.round(performance.now() - startTime);
            setSearchMeta({ tookMs: took, total: data.total || data.events.length, isSearching: false });
            return;
          }
        }
      } catch (err) {
        console.warn('Live event search error:', err);
      }
      setSearchMeta((prev) => ({ ...prev, isSearching: false }));
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory]);

  const handleBuyFromFan = async (ticket: TicketItem) => {
    const ev = events.find((e) => e.id === ticket.event_id) || events[0];
    setSelectedEvent(ev);
    setActiveTab('events');
    await handleHoldTicket(ticket);
  };

  // Load events dynamically
  useEffect(() => {
    fetch('/api/catalog/events')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.events && data.events.length > 0) {
          setEvents(data.events);
        }
      })
      .catch(() => {});
  }, []);

  // Load user orders
  useEffect(() => {
    if (!activeUser?.id) return;
    fetch(`/api/orders/user/${activeUser.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.orders) {
          const loaded: OrderItem[] = data.orders.map((o: any) => ({
            id: o.id,
            ticket_id: o.ticket_id || o.ticketId,
            event_id: o.event_id || o.eventId,
            event_title: o.event_id === 'evt_1' ? 'Coldplay - Music of the Spheres' : 'Live Event Ticket',
            seat_info: `Section VIP • Seat #${(o.ticket_id || o.ticketId).slice(-3)}`,
            amount: Number(o.amount) || 0,
            status: o.status,
            qr_code: o.qr_code || o.qrCode,
            created_at: o.created_at || o.createdAt,
          }));
          setOrders(loaded);
        }
      })
      .catch(() => {});
  }, [activeUser.id]);

  // Real-time WebSockets
  useEffect(() => {
    const s = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      if (activeUser?.id) {
        s.emit('joinUserRoom', activeUser.id);
      }
      if (selectedEvent?.id) {
        s.emit('joinEventRoom', selectedEvent.id);
      }
    });

    s.on('seatUpdated', (update: any) => {
      loadResaleTickets();
      const ticketId = update.ticket_id || update.ticketId;
      if (!ticketId) return;

      setTickets((prev) =>
        prev.map((t) => {
          if (t.id === ticketId) {
            return {
              ...t,
              status: update.status || t.status,
              held_by_user_id: update.held_by_user_id !== undefined ? update.held_by_user_id : t.held_by_user_id,
              hold_expires_at: update.hold_expires_at !== undefined ? update.hold_expires_at : t.hold_expires_at,
              is_resale: update.is_resale !== undefined ? update.is_resale : t.is_resale,
              price: update.price !== undefined ? Number(update.price) : t.price,
            };
          }
          return t;
        })
      );

      setHeldTicket((currHeld) => {
        if (currHeld && currHeld.id === ticketId) {
          if (update.status === 'AVAILABLE' && update.held_by_user_id !== activeUser.id) {
            return null;
          }
          if (update.status === 'SOLD') {
            return null;
          }
        }
        return currHeld;
      });
    });

    s.on('orderUpdated', (orderUpdate: any) => {
      loadResaleTickets();
      const orderId = orderUpdate.orderId || orderUpdate.id;
      if (orderUpdate.status === 'COMPLETED') {
        const completedOrder: OrderItem = {
          id: orderId || `ord_${Date.now()}`,
          ticket_id: orderUpdate.ticketId || orderUpdate.ticket_id || '',
          event_id: orderUpdate.eventId || selectedEvent?.id || '',
          event_title: selectedEvent?.title || 'Live Event',
          seat_info: `Section VIP • Seat #${(orderUpdate.ticketId || '').slice(-3)}`,
          amount: Number(orderUpdate.amount) || 0,
          status: 'COMPLETED',
          qr_code: orderUpdate.qr_code || orderUpdate.qrCode || `TKT-${orderId}-PASS`,
          created_at: orderUpdate.timestamp || new Date().toISOString(),
        };

        setOrders((prev) => [completedOrder, ...prev.filter((o) => o.id !== orderId)]);
        setIsProcessingCheckout(false);
        setIsCheckoutModalOpen(false);
        setHeldTicket(null);
        addToast('success', 'Order Confirmed!', `Your official ticket pass is ready in My Tickets.`);
      } else if (orderUpdate.status === 'CANCELLED') {
        setIsProcessingCheckout(false);
        setIsCheckoutModalOpen(false);
        setHeldTicket(null);
        addToast('error', 'Checkout Cancelled', orderUpdate.reason || 'Payment could not be processed.');
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [activeUser.id]);

  useEffect(() => {
    if (socket && selectedEvent?.id) {
      socket.emit('joinEventRoom', selectedEvent.id);
    }
  }, [selectedEvent?.id, socket]);

  // Load seats when event selected
  useEffect(() => {
    if (!selectedEvent) return;

    fetch(`/api/inventory/events/${selectedEvent.id}/tickets`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.tickets && data.tickets.length > 0) {
          setTickets(data.tickets);
        } else {
          generateSeedSeats(selectedEvent.id);
        }
      })
      .catch(() => {
        generateSeedSeats(selectedEvent.id);
      });
  }, [selectedEvent]);

  function generateSeedSeats(eventId: string) {
    const mockSeats: TicketItem[] = [];
    const sections = ['VIP Lower', 'Section 102', 'General Standing'];
    let count = 1;
    for (const section of sections) {
      for (let r = 1; r <= 3; r++) {
        for (let s = 1; s <= 6; s++) {
          const id = `tkt_${eventId}_${count++}`;
          const price = section === 'VIP Lower' ? 180 : section === 'Section 102' ? 110 : 85;
          mockSeats.push({
            id,
            event_id: eventId,
            section,
            row: String.fromCharCode(64 + r),
            seat_number: s,
            price,
            status: count % 9 === 0 ? 'SOLD' : 'AVAILABLE',
            is_resale: false,
          });
        }
      }
    }
    setTickets(mockSeats);
  }

  // Hold Countdown Timer
  useEffect(() => {
    if (!heldTicket) return;
    const interval = setInterval(() => {
      setHoldTimeRemaining((prev) => {
        if (prev <= 1) {
          handleReleaseHold(heldTicket.id);
          clearInterval(interval);
          addToast('info', 'Hold Expired', 'Your 10-minute seat reservation has expired.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [heldTicket]);

  const handleHoldTicket = async (ticket: TicketItem) => {
    if (ticket.status !== 'AVAILABLE') return;

    if (!token || activeUser.role === 'GUEST') {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const res = await fetch('/api/inventory/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticket.id,
          user_id: activeUser.id,
          hold_duration_seconds: 600,
          event_id: selectedEvent?.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast('error', 'Seat Unavailable', err.message || 'This seat is currently reserved by another guest.');
        return;
      }
    } catch {
      // Offline fallback
    }

    setHeldTicket(ticket);
    setHoldTimeRemaining(600);
    addToast('success', 'Seat Reserved', `${ticket.section} • Row ${ticket.row} Seat ${ticket.seat_number} reserved for 10 minutes.`);

    setTickets((prev) =>
      prev.map((t) =>
        t.id === ticket.id ? { ...t, status: 'HELD', held_by_user_id: activeUser.id, hold_expires_at: Date.now() + 600000 } : t
      )
    );
  };

  const handleReleaseHold = async (ticketId: string) => {
    try {
      await fetch('/api/inventory/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: ticketId,
          user_id: activeUser.id,
          event_id: selectedEvent?.id,
        }),
      });
    } catch {}

    setHeldTicket(null);
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'AVAILABLE', held_by_user_id: '' } : t))
    );
  };

  const handleCompletePayment = async (simulateDecline: boolean = false) => {
    if (!heldTicket || !selectedEvent) return;

    setIsProcessingCheckout(true);
    const chargeAmount = simulateDecline ? 999.99 : heldTicket.price;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUser.id,
          ticket_id: heldTicket.id,
          event_id: selectedEvent.id,
          amount: chargeAmount,
        }),
      });
      const orderData = await res.json();

      setTimeout(async () => {
        if (simulateDecline) {
          setIsProcessingCheckout(false);
          setIsCheckoutModalOpen(false);
          setTickets((prev) =>
            prev.map((t) => (t.id === heldTicket.id ? { ...t, status: 'AVAILABLE' } : t))
          );
          setHeldTicket(null);
          addToast('error', 'Payment Declined', 'The card was declined by issuing bank. Seat reservation released.');
        } else {
          if (orderData?.id) {
            try {
              const checkRes = await fetch(`/api/orders/${orderData.id}`);
              const updatedOrder = await checkRes.json();
              if (updatedOrder && updatedOrder.status === 'COMPLETED') {
                const newOrder: OrderItem = {
                  id: updatedOrder.id,
                  ticket_id: heldTicket.id,
                  event_id: selectedEvent.id,
                  event_title: selectedEvent.title,
                  seat_info: `${heldTicket.section} • Row ${heldTicket.row} • Seat ${heldTicket.seat_number}`,
                  amount: heldTicket.price,
                  status: 'COMPLETED',
                  qr_code: updatedOrder.qr_code || `TKT-${selectedEvent.id}-${heldTicket.id}-PASS`,
                  created_at: updatedOrder.created_at || new Date().toISOString(),
                };

                setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== updatedOrder.id)]);
                setTickets((prev) =>
                  prev.map((t) => (t.id === heldTicket.id ? { ...t, status: 'SOLD' } : t))
                );
                setHeldTicket(null);
                setIsProcessingCheckout(false);
                setIsCheckoutModalOpen(false);
                setActiveTab('my-tickets');
                setSelectedEvent(null);
                addToast('success', 'Order Confirmed!', `Your official ticket pass is ready.`);
              }
            } catch {}
          }
        }
      }, 1600);
    } catch (err) {
      setIsProcessingCheckout(false);
      setIsCheckoutModalOpen(false);
      addToast('error', 'Connection Error', 'Could not reach payment gateway.');
    }
  };

  const handleListResale = (order: OrderItem) => {
    const price = parseFloat(resalePriceInput) || 100;
    fetch('/api/inventory/resale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: order.ticket_id,
        seller_id: activeUser.id,
        resale_price: price,
      }),
    }).catch(() => {});

    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setResaleModalTicket(null);
    loadResaleTickets();
    addToast('success', 'Listed for Resale', `Ticket listed on marketplace for $${price}. Barcode secured.`);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Toast Notification Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-300',
              toast.type === 'success' && 'bg-slate-900/95 border-emerald-500/40 text-emerald-400',
              toast.type === 'error' && 'bg-slate-900/95 border-rose-500/40 text-rose-400',
              toast.type === 'info' && 'bg-slate-900/95 border-sky-500/40 text-sky-400'
            )}
          >
            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{toast.title}</p>
              <p className="text-xs text-slate-400 mt-1 leading-normal">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Modern Customer Announcement Bar */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-b border-emerald-500/20 px-6 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">Official Fan-to-Fan Marketplace</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-400 hidden sm:inline">100% Guaranteed Anti-Fraud Barcodes</span>
            <span className="text-slate-600 hidden md:inline">•</span>
            <span className="text-slate-400 hidden md:inline">Zero Hidden Checkout Fees</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <span className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Worldwide Events</span>
            </span>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-6 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group select-none" 
            onClick={() => { setSelectedEvent(null); setActiveTab('events'); }}
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200">
              <Ticket className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  TicketHub
                </span>
                <Badge variant="outline" className="text-[10px] py-0 px-2 text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                  Verified
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">Live Concerts & Stadium Sports</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <Button
              variant={activeTab === 'events' && !selectedEvent ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setActiveTab('events'); setSelectedEvent(null); }}
              className={cn(activeTab === 'events' && !selectedEvent && 'bg-slate-800 text-white font-semibold')}
            >
              Explore Events
            </Button>

            <Button
              variant={activeTab === 'resale' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setActiveTab('resale'); setSelectedEvent(null); }}
              className={cn(activeTab === 'resale' && 'bg-purple-950/60 text-purple-300 border border-purple-500/30')}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-400" />
              <span>Resale Market</span>
            </Button>

            <Button
              variant={activeTab === 'my-tickets' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => { setActiveTab('my-tickets'); setSelectedEvent(null); }}
              className={cn(
                'relative',
                activeTab === 'my-tickets' && 'bg-sky-950/60 text-sky-300 border border-sky-500/30'
              )}
            >
              <Ticket className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
              <span>My Tickets</span>
              {orders.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-sky-500 text-slate-950 text-[10px] font-bold">
                  {orders.length}
                </span>
              )}
            </Button>

            <div className="h-5 w-px bg-slate-800 mx-2 hidden sm:block"></div>

            {/* User Profile / Auth Button */}
            {token && activeUser.role !== 'GUEST' ? (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2.5 px-2 hover:bg-slate-900 border border-slate-800 rounded-xl"
                >
                  <Avatar fallback={activeUser.name.slice(0, 2).toUpperCase()} size="sm" />
                  <span className="text-xs font-medium text-slate-200">{activeUser.name.split(' ')[0]}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </Button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-800 bg-slate-900/95 p-2 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-3 border-b border-slate-800/80">
                      <p className="text-xs font-semibold text-white truncate">{activeUser.name}</p>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{activeUser.email}</p>
                      <Badge variant="success" className="mt-2 text-[10px] uppercase font-bold">
                        {activeUser.role} Account
                      </Badge>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => { setActiveTab('my-tickets'); setIsUserMenuOpen(false); }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition"
                      >
                        <Ticket className="w-3.5 h-3.5 text-slate-400" />
                        <span>My Tickets & Passes</span>
                      </button>
                      <button
                        onClick={() => { setActiveTab('resale'); setIsUserMenuOpen(false); }}
                        className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/60 rounded-lg transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>Resale Listings</span>
                      </button>
                    </div>

                    <Separator className="my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setAuthMode('login'); setIsAuthModalOpen(true); }}
                  className="text-slate-300 hover:text-white text-xs"
                >
                  Sign In
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { setAuthMode('register'); setIsAuthModalOpen(true); }}
                  className="text-xs"
                >
                  Create Account
                </Button>
              </div>
            )}
          </nav>
        </div>
      </header>

      {/* Active 10-Minute Cart Hold Banner */}
      {heldTicket && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border-b border-amber-500/30 px-6 py-3 sticky top-[65px] z-30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Clock className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold text-amber-300">
                  Seat Temporarily Reserved For You
                </p>
                <p className="text-xs text-slate-200">
                  {heldTicket.section} • Row {heldTicket.row} • Seat {heldTicket.seat_number} (${heldTicket.price})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded-xl text-xs font-mono font-bold text-amber-200">
                {formatTimer(holdTimeRemaining)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleReleaseHold(heldTicket.id)}
                className="text-xs text-slate-400 hover:text-rose-400"
              >
                Release
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsCheckoutModalOpen(true)}
                className="shadow-lg shadow-emerald-500/20 text-xs"
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* TAB 1: BROWSE EVENTS */}
        {activeTab === 'events' && !selectedEvent && (
          <div>
            {/* Hero & Search Header */}
            <div className="mb-10 text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="mb-3 py-1 px-3 text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                Official Live Entertainment
              </Badge>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-3 leading-tight">
                Find tickets to your favorite live events
              </h1>
              <p className="text-slate-400 text-sm max-w-xl mx-auto">
                Secure 100% verified tickets with instant digital mobile delivery, anti-fraud protection, and zero hidden service fees.
              </p>

              {/* Search Bar & Category Filters */}
              <div className="mt-8 space-y-4">
                <div className="relative max-w-2xl mx-auto">
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by artist, team, venue, or city (e.g., 'Coldplay', 'Wembley', 'Zimmer')..."
                    icon={<Search className="w-4 h-4 text-slate-400" />}
                    rightElement={
                      searchMeta.isSearching ? (
                        <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                      ) : searchQuery ? (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null
                    }
                    className="h-12 text-sm bg-slate-900/90 border-slate-800 rounded-2xl shadow-xl focus-visible:ring-emerald-500/40"
                  />
                </div>

                {/* Category Pills */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  {[
                    { label: 'All Events', value: 'All', icon: Ticket },
                    { label: 'Concerts', value: 'Concerts', icon: Music },
                    { label: 'Sports', value: 'Sports', icon: Trophy },
                    { label: 'Theater & Arts', value: 'Theater', icon: Film },
                  ].map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategory === cat.value;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={cn(
                          'inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border',
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/20'
                            : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Clean Result Count */}
                <div className="text-xs text-slate-500 pt-2 flex items-center justify-center space-x-3">
                  <span>{events.length} {events.length === 1 ? 'event' : 'events'} found</span>
                  <span>•</span>
                  <span>Over 1,000,000 live stadium seats</span>
                  {searchMeta.tookMs !== undefined && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-mono font-medium">⚡ Instant search ({searchMeta.tookMs}ms)</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {events.map((event) => (
                <Card
                  key={event.id}
                  className="group overflow-hidden flex flex-col border-slate-800/80 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/5 bg-slate-900/60"
                >
                  {/* Event Thumbnail */}
                  <div className="h-48 relative overflow-hidden bg-slate-800">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 left-3">
                      <Badge variant="outline" className="bg-slate-950/80 backdrop-blur-md text-emerald-300 border-emerald-500/30">
                        {event.category}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-white text-base leading-snug line-clamp-2 group-hover:text-emerald-400 transition-colors">
                        {event.title}
                      </h3>
                      <p className="text-slate-400 text-xs line-clamp-2 mt-2 leading-relaxed">
                        {event.description}
                      </p>

                      <div className="mt-4 space-y-2 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span className="truncate">{event.venue_name}, {event.city}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                          <span>{new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-500 block">From</span>
                        <span className="text-lg font-extrabold text-emerald-400">${event.min_price}</span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedEvent(event)}
                        className="group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors"
                      >
                        <span>Select Seats</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: EVENT DETAILS & INTERACTIVE SEAT MAP */}
        {selectedEvent && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedEvent(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                ← Back to All Events
              </Button>
              <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">
                Official Event Page
              </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Event details */}
              <div className="lg:col-span-1 space-y-6">
                <Card className="overflow-hidden border-slate-800">
                  <img
                    src={selectedEvent.image_url}
                    alt={selectedEvent.title}
                    className="w-full h-48 object-cover"
                  />
                  <CardContent className="p-6 space-y-4">
                    <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                      {selectedEvent.category}
                    </Badge>
                    <h2 className="text-xl font-bold text-white leading-snug">{selectedEvent.title}</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedEvent.description}</p>

                    <Separator className="my-4" />

                    <div className="space-y-2.5 text-xs text-slate-300">
                      <div className="flex items-center space-x-2.5">
                        <MapPin className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{selectedEvent.venue_name}, {selectedEvent.city}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{new Date(selectedEvent.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                      <div className="flex items-center space-x-2.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>Guaranteed 100% Authentic Pass</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Seat Map Legend */}
                <Card className="border-slate-800 p-5">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3">Seat Legend</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-md bg-emerald-500/20 border border-emerald-500"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-md bg-amber-500/30 border border-amber-500"></div>
                      <span>Reserved (Hold)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-md bg-slate-800 border border-slate-700"></div>
                      <span>Sold Out</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded-md bg-purple-500/20 border border-purple-500"></div>
                      <span>Verified Resale</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Right Column: Interactive Seat Grid & Sticky Summary */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="border-slate-800 p-6 flex flex-col">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="font-bold text-white text-lg">Select Your Stadium Seats</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Click an available seat to hold it for 10 minutes while you checkout.</p>
                    </div>
                    <div className="bg-slate-800 px-3 py-1 rounded-xl text-xs text-slate-300 font-mono">
                      STAGE
                    </div>
                  </div>

                  {/* Stage Visual */}
                  <div className="w-3/4 mx-auto mb-8 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-emerald-500/20 border border-emerald-500/30 text-center text-xs font-semibold text-emerald-300 tracking-widest shadow-inner">
                    ✦ PERFORMANCE STAGE ✦
                  </div>

                  {/* Seat Groups */}
                  <div className="space-y-6">
                    {['VIP Lower', 'Section 102', 'General Standing'].map((section) => (
                      <div key={section} className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs font-bold text-slate-200">{section}</span>
                          <span className="text-xs text-emerald-400 font-mono font-semibold">
                            {section === 'VIP Lower' ? '$180' : section === 'Section 102' ? '$110' : '$85'}
                          </span>
                        </div>

                        <div className="grid grid-cols-6 gap-2.5">
                          {tickets
                            .filter((t) => t.section === section)
                            .map((ticket) => {
                              const isHeldByMe = heldTicket?.id === ticket.id;
                              const isHeld = ticket.status === 'HELD';
                              const isSold = ticket.status === 'SOLD';
                              const isAvailable = ticket.status === 'AVAILABLE';

                              let seatStyle = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500 cursor-pointer';

                              if (ticket.is_resale && isAvailable) {
                                seatStyle = 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-500/30 cursor-pointer';
                              } else if (isHeldByMe) {
                                seatStyle = 'bg-amber-500/30 border-amber-500 text-amber-200 ring-2 ring-amber-500/50 cursor-pointer';
                              } else if (isHeld) {
                                seatStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-500 opacity-60 cursor-not-allowed';
                              } else if (isSold) {
                                seatStyle = 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed';
                              }

                              return (
                                <button
                                  key={ticket.id}
                                  disabled={isSold || (isHeld && !isHeldByMe)}
                                  onClick={() => {
                                    if (isHeldByMe) {
                                      handleReleaseHold(ticket.id);
                                    } else {
                                      handleHoldTicket(ticket);
                                    }
                                  }}
                                  className={cn(
                                    'p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center select-none active:scale-95',
                                    seatStyle
                                  )}
                                >
                                  <span className="text-[11px] font-mono font-bold">
                                    {ticket.row}{ticket.seat_number}
                                  </span>
                                  <span className="text-[9px] opacity-80">${ticket.price}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary Bar */}
                  {heldTicket && (
                    <div className="mt-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-white">
                          Selected: {heldTicket.section} • Row {heldTicket.row} • Seat {heldTicket.seat_number}
                        </p>
                        <p className="text-[11px] text-emerald-400">Total: ${heldTicket.price}.00 (All fees included)</p>
                      </div>
                      <Button
                        variant="default"
                        onClick={() => setIsCheckoutModalOpen(true)}
                        className="shadow-lg shadow-emerald-500/25"
                      >
                        <span>Checkout Now</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: P2P RESALE MARKETPLACE */}
        {activeTab === 'resale' && (
          <div>
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Badge variant="outline" className="text-xs text-purple-400 border-purple-500/30 mb-2">
                  100% Verified Secondary Marketplace
                </Badge>
                <h1 className="text-3xl font-extrabold text-white">Fan-to-Fan Resale Market</h1>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Can't make the event? Fans resell authenticated passes at fair prices. Barcodes are re-encrypted on transfer with zero counterfeit risk.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadResaleTickets}
                className="text-purple-300 border-purple-500/30 hover:bg-purple-950/50"
              >
                <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', isLoadingResale && 'animate-spin')} />
                <span>Refresh Listings</span>
              </Button>
            </div>

            {resaleTickets.length === 0 ? (
              <Card className="border-slate-800 p-12 text-center space-y-4">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-slate-200 font-semibold text-base">No active resale listings at the moment</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  When verified ticket holders list their seats from the "My Tickets" vault, they appear instantly here for verified purchase.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('events')}
                >
                  Browse Primary Events
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {resaleTickets.map((ticket) => {
                  const ev = events.find((e) => e.id === ticket.event_id) || events[0];
                  const isMyListing = Boolean(activeUser.id && activeUser.id === ticket.seller_id);
                  const sellerLabel = isMyListing ? 'You' : 'Verified Fan';

                  return (
                    <Card
                      key={ticket.id}
                      className="border-purple-500/30 hover:border-purple-500/60 transition-all rounded-3xl p-5 space-y-4 shadow-xl shadow-purple-500/5 bg-slate-900/80"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="purple" className="text-[10px] flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 mr-1" />
                          <span>Verified Resale</span>
                        </Badge>
                        <span className="text-xs text-slate-400">
                          Seller: <span className="text-slate-200 font-semibold">{sellerLabel}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base leading-snug">{ev?.title || 'Live Event'}</h3>

                      <div className="text-xs text-slate-400 space-y-1">
                        <p>{ticket.section} • Row {ticket.row} • Seat {ticket.seat_number}</p>
                        <p className="text-emerald-400 font-semibold flex items-center space-x-1 pt-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>100% Anti-Fraud Re-Issued Barcode</span>
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Resale Price</span>
                          <span className="text-xl font-extrabold text-purple-300 font-mono">${ticket.price}</span>
                        </div>
                        {isMyListing ? (
                          <Badge variant="secondary" className="text-xs py-1.5 px-3">
                            Your Active Listing
                          </Badge>
                        ) : (
                          <Button
                            variant="purple"
                            size="sm"
                            onClick={() => handleBuyFromFan(ticket)}
                          >
                            <span>Buy Ticket</span>
                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY TICKETS (APPLE/GOOGLE WALLET-STYLE PASSES) */}
        {activeTab === 'my-tickets' && (
          <div>
            <div className="mb-8">
              <Badge variant="outline" className="text-xs text-sky-400 border-sky-500/30 mb-2">
                Digital Pass Vault
              </Badge>
              <h1 className="text-3xl font-extrabold text-white">My Confirmed Tickets</h1>
              <p className="text-xs text-slate-400 mt-1">
                Your authenticated digital entry passes. Present at stadium gates for contactless entry or list for resale.
              </p>
            </div>

            {orders.length === 0 ? (
              <Card className="border-slate-800 p-12 text-center space-y-4">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-slate-200 font-semibold text-base">No tickets in your vault yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Find your favorite concert or game, reserve your seat, and complete checkout to see your digital wallet passes here.
                </p>
                <Button
                  variant="default"
                  onClick={() => setActiveTab('events')}
                >
                  Explore Events
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="relative bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl transition hover:border-sky-500/40"
                  >
                    {/* Wallet Pass Header Banner */}
                    <div className="p-6 bg-slate-900/90 border-b border-slate-800/80">
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="sky" className="text-[10px] font-bold tracking-wider uppercase mb-2">
                            AUTHENTIC MOBILE ENTRY PASS
                          </Badge>
                          <h3 className="text-lg font-bold text-white">{order.event_title}</h3>
                          <p className="text-xs text-slate-300 mt-1">{order.seat_info}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Total Paid</span>
                          <span className="text-base font-extrabold text-emerald-400">${order.amount}.00</span>
                        </div>
                      </div>
                    </div>

                    {/* Perforated Edge Divider */}
                    <div className="relative flex items-center justify-between px-3 py-1 bg-slate-950">
                      <div className="w-4 h-4 rounded-full bg-slate-950 -ml-5 border-r border-slate-800"></div>
                      <div className="flex-1 border-t-2 border-dashed border-slate-800/80 mx-2"></div>
                      <div className="w-4 h-4 rounded-full bg-slate-950 -mr-5 border-l border-slate-800"></div>
                    </div>

                    {/* Barcode & Security Section */}
                    <div className="p-6 space-y-4">
                      <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800/80 flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono block">Entry Barcode</span>
                          <code className="text-xs text-sky-400 font-mono font-semibold">{order.qr_code}</code>
                          <span className="text-[10px] text-slate-500 block flex items-center space-x-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>Encrypted Anti-Duplicate Signature</span>
                          </span>
                        </div>
                        {/* Dynamic Scan Visual */}
                        <div className="w-14 h-14 bg-white p-1 rounded-xl flex items-center justify-center shadow">
                          <div className="w-12 h-12 bg-slate-950 grid grid-cols-3 gap-0.5 p-1 rounded-lg">
                            <div className="bg-white"></div><div className="bg-slate-950"></div><div className="bg-white"></div>
                            <div className="bg-slate-950"></div><div className="bg-white"></div><div className="bg-white"></div>
                            <div className="bg-white"></div><div className="bg-slate-950"></div><div className="bg-white"></div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] text-slate-500 font-mono">Pass #{order.id.slice(-8)}</span>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToast('info', 'Apple Wallet', 'Pass exported to Apple Wallet format.')}
                            className="text-xs"
                          >
                            <Smartphone className="w-3.5 h-3.5 mr-1" />
                            <span>Save to Wallet</span>
                          </Button>
                          <Button
                            variant="purple"
                            size="sm"
                            onClick={() => setResaleModalTicket(order)}
                            className="text-xs"
                          >
                            Resell Ticket
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modern Checkout Modal */}
      <Dialog open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen} maxWidth="max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Ticket Order</DialogTitle>
          <DialogDescription>
            Review your reservation and enter payment details to finalize your digital pass.
          </DialogDescription>
        </DialogHeader>

        {heldTicket && (
          <div className="space-y-5">
            {/* Ticket Summary Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Event</span>
                <span className="text-white font-semibold truncate max-w-[200px]">{selectedEvent?.title}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Seat Allocation</span>
                <span className="text-white font-semibold">{heldTicket.section} • Row {heldTicket.row} • Seat {heldTicket.seat_number}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Hold Timer</span>
                <span className="text-amber-400 font-mono font-bold">{formatTimer(holdTimeRemaining)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300 font-medium">Total Amount</span>
                <span className="text-emerald-400 font-bold text-base">${heldTicket.price}.00</span>
              </div>
            </div>

            {/* Payment Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Cardholder Name</label>
                <Input
                  type="text"
                  value={checkoutForm.cardName}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, cardName: e.target.value })}
                  placeholder="Full name on card"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Card Number</label>
                <Input
                  type="text"
                  value={checkoutForm.cardNumber}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, cardNumber: e.target.value })}
                  icon={<CreditCard className="w-4 h-4" />}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Expires</label>
                  <Input
                    type="text"
                    value={checkoutForm.cardExpiry}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, cardExpiry: e.target.value })}
                    placeholder="MM/YY"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">CVC</label>
                  <Input
                    type="password"
                    value={checkoutForm.cardCvc}
                    onChange={(e) => setCheckoutForm({ ...checkoutForm, cardCvc: e.target.value })}
                    placeholder="•••"
                  />
                </div>
              </div>
            </div>

            {/* Subtle Simulation Toggle for testing decline */}
            <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] text-slate-500">256-Bit SSL Encrypted Checkout</span>
              <button
                type="button"
                onClick={() => setCheckoutForm({ ...checkoutForm, simulateDecline: !checkoutForm.simulateDecline })}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded transition',
                  checkoutForm.simulateDecline
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'text-slate-500 hover:text-slate-400'
                )}
              >
                {checkoutForm.simulateDecline ? 'Simulate Decline: ON' : 'Test Mode'}
              </button>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={isProcessingCheckout}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                disabled={isProcessingCheckout}
                onClick={() => handleCompletePayment(checkoutForm.simulateDecline)}
                className="w-full sm:w-auto"
              >
                {isProcessingCheckout ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <span>Pay ${heldTicket.price}.00</span>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Resale Modal */}
      {resaleModalTicket && (
        <Dialog open={Boolean(resaleModalTicket)} onOpenChange={() => setResaleModalTicket(null)} maxWidth="max-w-md">
          <DialogHeader>
            <DialogTitle>List Ticket on Resale Market</DialogTitle>
            <DialogDescription>
              Set your asking price for {resaleModalTicket.event_title}. Once sold, your barcode is invalidated and a fresh barcode is transferred to the buyer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-300 block mb-1">Your Resale Price ($ USD)</label>
              <Input
                type="number"
                value={resalePriceInput}
                onChange={(e) => setResalePriceInput(e.target.value)}
                placeholder="100"
              />
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-500/30 rounded-xl text-xs text-purple-300 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>TicketHub Fair-Price Policy protects fans from aggressive scalping. Payouts are transferred immediately after event completion.</span>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setResaleModalTicket(null)}>
                Cancel
              </Button>
              <Button variant="purple" onClick={() => handleListResale(resaleModalTicket)}>
                Confirm Listing
              </Button>
            </DialogFooter>
          </div>
        </Dialog>
      )}

      {/* Auth Modal (Sign In / Register) */}
      <Dialog open={isAuthModalOpen} onOpenChange={setIsAuthModalOpen} maxWidth="max-w-md">
        <DialogHeader>
          <DialogTitle>{authMode === 'login' ? 'Sign In to TicketHub' : 'Create Fan Account'}</DialogTitle>
          <DialogDescription>
            {authMode === 'login'
              ? 'Access your mobile tickets, seat holds, and resale listings.'
              : 'Join to reserve stadium seats and purchase verified passes.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={authMode} onValueChange={(val) => { setAuthMode(val as any); setAuthError(''); }}>
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          {authError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <TabsContent value="login">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleLogin(authForm.email, authForm.password);
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Email Address</label>
                <Input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="name@example.com"
                  icon={<Mail className="w-4 h-4 text-slate-500" />}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                  icon={<Lock className="w-4 h-4 text-slate-500" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <Button type="submit" variant="default" className="w-full" disabled={authLoading}>
                {authLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                <span>Sign In</span>
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Full Name</label>
                <Input
                  type="text"
                  required
                  value={authForm.name}
                  onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                  placeholder="Jane Fan"
                  icon={<User className="w-4 h-4 text-slate-500" />}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Email Address</label>
                <Input
                  type="email"
                  required
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="jane@example.com"
                  icon={<Mail className="w-4 h-4 text-slate-500" />}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Password</label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="At least 6 characters"
                  icon={<Lock className="w-4 h-4 text-slate-500" />}
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthForm({ ...authForm, role: 'BUYER' })}
                    className={cn(
                      'p-3 rounded-xl border text-left transition',
                      authForm.role === 'BUYER'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Buyer</span>
                      {authForm.role === 'BUYER' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Buy & hold seats</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthForm({ ...authForm, role: 'SELLER' })}
                    className={cn(
                      'p-3 rounded-xl border text-left transition',
                      authForm.role === 'SELLER'
                        ? 'bg-purple-500/10 border-purple-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    )}
                  >
                    <div className="font-semibold text-xs flex items-center justify-between">
                      <span>Reseller</span>
                      {authForm.role === 'SELLER' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">List & transfer passes</p>
                  </button>
                </div>
              </div>

              <Button type="submit" variant="default" className="w-full" disabled={authLoading}>
                {authLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                <span>Create Free Account</span>
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Dialog>

      {/* Production Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 px-6 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-300">TicketHub Official</span>
            <span>© {new Date().getFullYear()} TicketHub Inc. All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-6">
            <button
              onClick={() => setIsArchModalOpen(true)}
              className="hover:text-slate-300 transition text-[11px] underline underline-offset-4"
            >
              System Topology
            </button>
            <span className="hover:text-slate-300 transition">Terms of Service</span>
            <span className="hover:text-slate-300 transition">Privacy Policy</span>
            <span className="hover:text-slate-300 transition">Buyer Guarantee</span>
          </div>
        </div>
      </footer>

      {/* Discrete Architecture Topology Modal (Clean popup for technical inspection) */}
      <Dialog open={isArchModalOpen} onOpenChange={setIsArchModalOpen} maxWidth="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Underlying Microservices Architecture</DialogTitle>
          <DialogDescription>
            High-performance distributed backend topology powering TicketHub.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-emerald-400 font-semibold block">API Gateway</span>
              <span className="text-slate-400 text-[11px]">HTTP/REST & WebSocket routing into internal gRPC mesh</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-sky-400 font-semibold block">Elasticsearch & Redis</span>
              <span className="text-slate-400 text-[11px]">Sub-30ms typo-tolerant BM25 search & 10m TTL locks</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-purple-400 font-semibold block">RabbitMQ Saga</span>
              <span className="text-slate-400 text-[11px]">Choreographed payment escrow & automatic rollback</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => setIsArchModalOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
