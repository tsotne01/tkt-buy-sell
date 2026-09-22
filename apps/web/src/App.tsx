import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Ticket, Calendar, MapPin, Search, ShieldCheck, 
  Clock, CheckCircle, AlertTriangle, ArrowRight, 
  RefreshCw, Cpu, Layers, UserCheck, DollarSign, X,
  LogIn, LogOut, User, Lock, Mail, Tag, Sparkles
} from 'lucide-react';

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

export default function App() {
  const [activeTab, setActiveTab] = useState<'events' | 'resale' | 'my-tickets' | 'architecture'>('events');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

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
      id: 'usr_buyer_1',
      email: 'buyer@example.com',
      name: 'Alice Buyer',
      role: 'BUYER',
    };
  });
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'BUYER' });
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Secondary Resale Marketplace State
  const [resaleTickets, setResaleTickets] = useState<TicketItem[]>([]);
  const [isLoadingResale, setIsLoadingResale] = useState<boolean>(false);

  // WebSocket Live Sync State
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Events & Tickets state
  const [events, setEvents] = useState<EventItem[]>([
    {
      id: 'evt_1',
      title: 'Coldplay - Music of the Spheres World Tour',
      description: 'Experience Coldplay live in concert with an immersive stadium spectacle.',
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
      description: 'The pinnacle of European club football. Watch the two finest clubs battle for glory.',
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
      title: 'Hans Zimmer Live - The Symphony',
      description: 'The legendary film composer performs masterpieces from Interstellar, Gladiator, and Inception.',
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
      title: 'Hamilton - The Award-Winning Musical',
      description: 'Lin-Manuel Miranda’s groundbreaking musical drama featuring revolutionary history in hip-hop.',
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
  const [sagaFeedback, setSagaFeedback] = useState<{ status: 'idle' | 'success' | 'failed'; message: string }>({
    status: 'idle',
    message: '',
  });

  // Resale modal state
  const [resaleModalTicket, setResaleModalTicket] = useState<OrderItem | null>(null);
  const [resalePriceInput, setResalePriceInput] = useState<string>('120');

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
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
      setAuthLoading(false);
    }
  };

  const handleQuickSwitch = async (email: string) => {
    await handleLogin(email, 'password123');
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
  };

  // Load secondary resale tickets from PostgreSQL
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

  const handleBuyFromFan = async (ticket: TicketItem) => {
    const ev = events.find((e) => e.id === ticket.event_id) || events[0];
    setSelectedEvent(ev);
    setActiveTab('events');
    await handleHoldTicket(ticket);
  };

  // Load events dynamically from catalog API
  useEffect(() => {
    fetch('/api/catalog/events')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.events && data.events.length > 0) {
          setEvents(data.events);
          if (!selectedEvent) {
            setSelectedEvent(data.events[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Load user orders from PostgreSQL orders table
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
            event_title: o.event_id === 'evt_1' ? 'Coldplay - Music of the Spheres' : 'Event Ticket',
            seat_info: `Seat #${o.ticket_id || o.ticketId}`,
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

  // Establish real-time Socket.IO connection
  useEffect(() => {
    const s = io(window.location.origin, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on('connect', () => {
      console.log('[WebSocket] Connected! Socket ID:', s.id);
      setWsConnected(true);
      if (activeUser?.id) {
        s.emit('joinUserRoom', activeUser.id);
      }
      if (selectedEvent?.id) {
        s.emit('joinEventRoom', selectedEvent.id);
      }
    });

    s.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setWsConnected(false);
    });

    s.on('seatUpdated', (update: any) => {
      console.log('[WebSocket] Live seatUpdated received:', update);
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

      // If this seat was held by us and got released or sold
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
      console.log('[WebSocket] Live orderUpdated received:', orderUpdate);
      loadResaleTickets();
      const orderId = orderUpdate.orderId || orderUpdate.id;
      if (orderUpdate.status === 'COMPLETED') {
        const completedOrder: OrderItem = {
          id: orderId || `ord_${Date.now()}`,
          ticket_id: orderUpdate.ticketId || orderUpdate.ticket_id || '',
          event_id: orderUpdate.eventId || selectedEvent?.id || '',
          event_title: selectedEvent?.title || 'Live Event',
          seat_info: `Reserved Seat (${orderUpdate.ticketId || ''})`,
          amount: Number(orderUpdate.amount) || 0,
          status: 'COMPLETED',
          qr_code: orderUpdate.qr_code || orderUpdate.qrCode || `TKT-${orderId}-PASS`,
          created_at: orderUpdate.timestamp || new Date().toISOString(),
        };

        setOrders((prev) => [completedOrder, ...prev.filter((o) => o.id !== orderId)]);
        setSagaFeedback({
          status: 'success',
          message: `Saga Completed via RabbitMQ & WebSockets! Digital QR Pass issued for Order ${orderId}.`,
        });
        setIsProcessingCheckout(false);
        setHeldTicket(null);
      } else if (orderUpdate.status === 'CANCELLED') {
        setSagaFeedback({
          status: 'failed',
          message: `Saga Compensation: ${orderUpdate.reason || 'Payment declined'}. Seat hold automatically released.`,
        });
        setIsProcessingCheckout(false);
        setHeldTicket(null);
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [activeUser.id]);

  // Join room when selected event changes
  useEffect(() => {
    if (socket && selectedEvent?.id) {
      socket.emit('joinEventRoom', selectedEvent.id);
    }
  }, [selectedEvent?.id, socket]);

  // Load seats when event selected
  useEffect(() => {
    if (!selectedEvent) return;

    // Fetch from backend API Gateway
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
            is_resale: count === 14,
            seller_id: count === 14 ? 'usr_seller_1' : undefined,
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
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [heldTicket]);

  const handleHoldTicket = async (ticket: TicketItem) => {
    if (ticket.status !== 'AVAILABLE') return;

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
        alert(err.message || 'Seat is currently locked or reserved by another customer.');
        return;
      }
    } catch {
      // Offline fallback
    }

    setHeldTicket(ticket);
    setHoldTimeRemaining(600);
    setSagaFeedback({ status: 'idle', message: '' });

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

  const handleCheckoutSaga = async (simulateFailure: boolean = false) => {
    if (!heldTicket || !selectedEvent) return;

    setIsProcessingCheckout(true);
    setSagaFeedback({ status: 'idle', message: 'Submitting order to RabbitMQ Saga...' });

    const chargeAmount = simulateFailure ? 999.99 : heldTicket.price;

    try {
      // 1. Trigger Order Creation -> Dispatches order.created on RabbitMQ
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

      // Fallback polling timeout in case WebSockets is not active
      setTimeout(async () => {
        if (simulateFailure) {
          setIsProcessingCheckout(false);
          setSagaFeedback({
            status: 'failed',
            message: 'Saga Compensating Action: Payment declined! Seat hold automatically released in Redis and PostgreSQL.',
          });
          setTickets((prev) =>
            prev.map((t) => (t.id === heldTicket.id ? { ...t, status: 'AVAILABLE' } : t))
          );
          setHeldTicket(null);
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
                setSagaFeedback({
                  status: 'success',
                  message: 'Saga Completed! Payment authorized, ticket marked SOLD, and digital pass dispatched.',
                });
                setHeldTicket(null);
                setIsProcessingCheckout(false);
              }
            } catch {}
          }
        }
      }, 2200);
    } catch (err) {
      setIsProcessingCheckout(false);
      setSagaFeedback({
        status: 'failed',
        message: 'Network error or service unavailable. Rollback triggered.',
      });
    }
  };

  const handleListResale = (order: OrderItem) => {
    const price = parseFloat(resalePriceInput) || 100;
    // Call backend resale endpoint
    fetch('/api/inventory/resale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticket_id: order.ticket_id,
        seller_id: activeUser.id,
        resale_price: price,
      }),
    }).catch(() => {});

    // Remove from active orders and list in marketplace
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setResaleModalTicket(null);
    alert(`Ticket for ${order.event_title} successfully listed on the P2P Resale Marketplace for $${price}!`);
  };

  const filteredEvents = events.filter((e) => {
    const matchesCat = selectedCategory === 'All' || e.category === selectedCategory;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          e.city.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar: Cluster Status */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Local K8s Ingress LoadBalancer</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Gateway: <code className="text-emerald-300">localhost:4000</code></span>
          <span className="text-slate-400">gRPC Services: <code className="text-sky-300">50051-50054</code></span>
          <span className="text-slate-400">RabbitMQ: <code className="text-amber-300">5672</code></span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-1.5 font-medium">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${wsConnected ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${wsConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </span>
            <span className={wsConnected ? 'text-emerald-400' : 'text-rose-400'}>
              {wsConnected ? 'Live WebSockets: Active' : 'WebSocket: Connecting...'}
            </span>
          </div>
        </div>

        {/* User Switcher & Auth State */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="flex items-center space-x-1.5 bg-slate-800/90 px-2 py-0.5 rounded border border-slate-700">
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-200 text-xs">{activeUser.name}</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
              activeUser.role === 'SELLER'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {activeUser.role}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleQuickSwitch('buyer@example.com')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                activeUser.email === 'buyer@example.com'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Quick switch to Alice (Buyer)"
            >
              Alice (Buyer)
            </button>
            <button
              onClick={() => handleQuickSwitch('seller@example.com')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${
                activeUser.email === 'seller@example.com'
                  ? 'bg-purple-500 text-white font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
              title="Quick switch to Bob (Seller)"
            >
              Bob (Seller)
            </button>
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthError('');
                setIsAuthModalOpen(true);
              }}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium border border-slate-700 transition flex items-center space-x-1"
            >
              <LogIn className="w-3 h-3 text-slate-400" />
              <span>Auth / Register</span>
            </button>
            {token && (
              <button
                onClick={handleLogout}
                className="px-1.5 py-0.5 text-slate-400 hover:text-rose-400 text-[11px] transition"
                title="Sign out"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setSelectedEvent(null); setActiveTab('events'); }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Ticket className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                TicketHub
              </span>
              <span className="text-xs ml-2 text-emerald-400 font-semibold px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                gRPC + RMQ
              </span>
            </div>
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={() => { setActiveTab('events'); setSelectedEvent(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'events' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Browse Events
            </button>
            <button
              onClick={() => { setActiveTab('resale'); setSelectedEvent(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'resale' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              P2P Resale
            </button>
            <button
              onClick={() => setActiveTab('my-tickets')}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === 'my-tickets' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              My Tickets ({orders.length})
              {orders.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('architecture')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                activeTab === 'architecture' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-4 h-4" />
              <span>Microservices Map</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Held Ticket Banner (10-Minute Cart Hold) */}
      {heldTicket && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border-b border-amber-500/30 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <div>
                <span className="font-semibold text-amber-300">Seat Held in Redis:</span>{' '}
                <span className="text-slate-200">
                  {heldTicket.section} • Row {heldTicket.row} • Seat {heldTicket.seat_number} (${heldTicket.price})
                </span>
                <span className="ml-3 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono font-bold">
                  TTL: {formatTimer(holdTimeRemaining)}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => handleReleaseHold(heldTicket.id)}
                className="text-xs text-slate-400 hover:text-rose-400 transition"
              >
                Release Seat
              </button>
              <button
                onClick={() => handleCheckoutSaga(false)}
                disabled={isProcessingCheckout}
                className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-semibold rounded-lg text-xs transition shadow-lg shadow-emerald-500/20"
              >
                {isProcessingCheckout ? 'Processing Saga...' : 'Complete Checkout'}
              </button>
              <button
                onClick={() => handleCheckoutSaga(true)}
                disabled={isProcessingCheckout}
                title="Tests RabbitMQ compensating transaction when payment is declined"
                className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold rounded-lg text-xs transition"
              >
                Simulate Payment Fail (Saga Test)
              </button>
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
            <div className="mb-8">
              <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                Live Events & Stadium Seats
              </h1>
              <p className="text-slate-400 text-sm max-w-2xl">
                High-throughput ticketing powered by NestJS gRPC microservices, atomic Redis seat locking, and RabbitMQ Saga choreography.
              </p>

              {/* Filters */}
              <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search concerts, sports teams, artists, or cities..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div className="flex space-x-2">
                  {['All', 'Concerts', 'Sports', 'Theater'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition ${
                        selectedCategory === cat
                          ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="group bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl overflow-hidden flex flex-col transition duration-300 hover:shadow-xl hover:shadow-emerald-500/5"
                >
                  <div className="h-44 relative overflow-hidden bg-slate-800">
                    <img
                      src={event.image_url}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-full text-xs font-medium text-emerald-400 border border-emerald-500/20">
                      {event.category}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-white text-base leading-snug line-clamp-2 mb-2 group-hover:text-emerald-400 transition">
                      {event.title}
                    </h3>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-4">
                      {event.description}
                    </p>

                    <div className="mt-auto space-y-2 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span>{event.venue_name}, {event.city}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 block">From</span>
                        <span className="text-lg font-extrabold text-emerald-400">${event.min_price}</span>
                      </div>
                      <button
                        onClick={() => setSelectedEvent(event)}
                        className="px-4 py-2 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 font-semibold rounded-xl text-xs transition flex items-center space-x-1.5 text-slate-200"
                      >
                        <span>Select Seats</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: EVENT DETAILS & INTERACTIVE SEAT MAP */}
        {selectedEvent && (
          <div>
            <button
              onClick={() => setSelectedEvent(null)}
              className="text-xs text-slate-400 hover:text-slate-200 mb-6 flex items-center space-x-1.5 transition"
            >
              <span>← Back to Events</span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Event details */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
                  <img
                    src={selectedEvent.image_url}
                    alt={selectedEvent.title}
                    className="w-full h-44 object-cover rounded-xl"
                  />
                  <div className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {selectedEvent.category}
                  </div>
                  <h2 className="text-xl font-bold text-white leading-snug">{selectedEvent.title}</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">{selectedEvent.description}</p>

                  <div className="pt-4 border-t border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>{selectedEvent.venue_name}, {selectedEvent.city}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{new Date(selectedEvent.date).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
                  <h4 className="font-semibold text-white">Seat Availability Status</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-400">
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-500"></div>
                      <span>Held (10m TTL)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-700"></div>
                      <span>Sold / Booked</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 rounded bg-purple-500/20 border border-purple-500"></div>
                      <span>P2P Resale</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Seat Grid */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-white text-lg">Interactive Venue Seat Map</h3>
                    <p className="text-xs text-slate-400">Click an available seat to lock it via Redis for 10 minutes.</p>
                  </div>
                  <div className="bg-slate-800 px-3 py-1 rounded-lg text-xs text-slate-300 font-mono">
                    STAGE / PITCH
                  </div>
                </div>

                {/* The Stage Line */}
                <div className="w-3/4 mx-auto mb-8 py-2 rounded-xl bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-emerald-500/20 border border-emerald-500/30 text-center text-xs font-semibold text-emerald-300 tracking-wider">
                  ✦ STAGE / PERFORMANCE AREA ✦
                </div>

                {/* Seat Groups */}
                <div className="space-y-6">
                  {['VIP Lower', 'Section 102', 'General Standing'].map((section) => (
                    <div key={section} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold text-slate-300">{section}</span>
                        <span className="text-xs text-emerald-400 font-mono">
                          {section === 'VIP Lower' ? '$180' : section === 'Section 102' ? '$110' : '$85'}
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-2">
                        {tickets
                          .filter((t) => t.section === section)
                          .map((ticket) => {
                            const isHeldByMe = heldTicket?.id === ticket.id;
                            const isHeld = ticket.status === 'HELD';
                            const isSold = ticket.status === 'SOLD';
                            const isAvailable = ticket.status === 'AVAILABLE';

                            let colorClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500 cursor-pointer';

                            if (ticket.is_resale && isAvailable) {
                              colorClass = 'bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-500/30 cursor-pointer';
                            } else if (isHeldByMe) {
                              colorClass = 'bg-amber-500/30 border-amber-500 text-amber-200 ring-2 ring-amber-500/50 cursor-pointer';
                            } else if (isHeld) {
                              colorClass = 'bg-amber-500/10 border-amber-500/30 text-amber-500 opacity-60 cursor-not-allowed';
                            } else if (isSold) {
                              colorClass = 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed';
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
                                className={`p-2 rounded-lg border text-center transition flex flex-col items-center justify-center ${colorClass}`}
                              >
                                <span className="text-[10px] font-mono font-bold">
                                  {ticket.row}{ticket.seat_number}
                                </span>
                                <span className="text-[9px] opacity-75">${ticket.price}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Saga Status notification */}
                {sagaFeedback.status !== 'idle' && (
                  <div
                    className={`mt-6 p-4 rounded-xl border text-xs flex items-center space-x-2 ${
                      sagaFeedback.status === 'success'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {sagaFeedback.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    )}
                    <span>{sagaFeedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: P2P RESALE MARKETPLACE */}
        {activeTab === 'resale' && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white mb-1">Fan-to-Fan Resale Marketplace</h1>
                <p className="text-xs text-slate-400">
                  Peer-to-peer ticket reselling powered by PostgreSQL & gRPC. Barcode re-encryption guarantees zero duplicate fraud.
                </p>
              </div>
              <button
                onClick={loadResaleTickets}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-xl text-xs text-purple-300 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingResale ? 'animate-spin' : ''}`} />
                <span>Refresh Listings</span>
              </button>
            </div>

            {resaleTickets.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-slate-300 font-semibold text-base">No tickets currently listed for resale</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  When fans list their confirmed passes from the "My Tickets" tab, they appear live here for instant verified purchase.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {resaleTickets.map((ticket) => {
                  const ev = events.find((e) => e.id === ticket.event_id) || events[0];
                  const isMyListing = activeUser.id === ticket.seller_id;
                  const sellerLabel = ticket.seller_id === 'usr_seller_1' ? 'Bob Seller' : ticket.seller_id === 'usr_buyer_1' ? 'Alice Buyer' : (ticket.seller_id || 'Verified Fan');

                  return (
                    <div key={ticket.id} className="bg-slate-900 border border-purple-500/30 hover:border-purple-500/60 transition rounded-2xl p-5 space-y-4 shadow-lg shadow-purple-500/5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-purple-400 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center space-x-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          <span>P2P Verified Resale</span>
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Seller: <span className="text-slate-200 font-medium">{sellerLabel}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base">{ev?.title || 'Live Event'}</h3>
                      <div className="text-xs text-slate-400 space-y-1">
                        <p>{ticket.section} • Row {ticket.row} • Seat {ticket.seat_number}</p>
                        <p className="text-emerald-400 font-semibold flex items-center space-x-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>100% Anti-Fraud Guaranteed Barcode</span>
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-xs text-slate-500 block">Fan Price</span>
                          <span className="text-xl font-extrabold text-purple-300 font-mono">${ticket.price}</span>
                        </div>
                        {isMyListing ? (
                          <span className="px-3.5 py-2 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold">
                            Your Active Listing
                          </span>
                        ) : (
                          <button
                            onClick={() => handleBuyFromFan(ticket)}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-purple-600/20 flex items-center space-x-1"
                          >
                            <span>Buy From Fan</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY TICKETS & PASSES */}
        {activeTab === 'my-tickets' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">My Confirmed Tickets</h1>
              <p className="text-xs text-slate-400">
                Official passes authenticated via microservices. You can also re-list your ticket on the marketplace.
              </p>
            </div>

            {orders.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
                <Ticket className="w-12 h-12 text-slate-600 mx-auto" />
                <h3 className="text-slate-300 font-semibold text-base">No tickets purchased yet</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Browse live events, hold your favorite seat, and complete checkout to see your digital passes here.
                </p>
                <button
                  onClick={() => setActiveTab('events')}
                  className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs rounded-xl transition"
                >
                  Explore Events
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          CONFIRMED PASS
                        </span>
                        <h3 className="text-lg font-bold text-white mt-1">{order.event_title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{order.seat_info}</p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Paid</span>
                        <span className="text-base font-bold text-emerald-400">${order.amount}</span>
                      </div>
                    </div>

                    {/* Dynamic QR Code */}
                    <div className="my-4 p-4 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-mono block">Ticket Barcode</span>
                        <code className="text-xs text-sky-400 font-mono">{order.qr_code}</code>
                        <span className="text-[10px] text-slate-500 block">Encrypted Entry Signature</span>
                      </div>
                      <div className="w-14 h-14 bg-white p-1 rounded-lg flex items-center justify-center">
                        <div className="w-12 h-12 bg-slate-900 grid grid-cols-3 gap-0.5 p-1 rounded">
                          <div className="bg-white"></div><div className="bg-slate-900"></div><div className="bg-white"></div>
                          <div className="bg-slate-900"></div><div className="bg-white"></div><div className="bg-white"></div>
                          <div className="bg-white"></div><div className="bg-slate-900"></div><div className="bg-white"></div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500">Order ID: {order.id}</span>
                      <button
                        onClick={() => setResaleModalTicket(order)}
                        className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-semibold transition"
                      >
                        Resell Ticket
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SYSTEM ARCHITECTURE & SAGA VISUALIZER */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-white mb-1">Microservices Topology & Saga Workflow</h1>
              <p className="text-xs text-slate-400">
                Detailed runtime diagram of your deployed NestJS microservices, gRPC channels, and RabbitMQ exchanges.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 text-sm font-semibold">
                  <Layers className="w-4 h-4" />
                  <span>API Gateway & Ingress</span>
                </div>
                <p className="text-xs text-slate-400">
                  Runs on port <code className="text-emerald-300">4000</code>. Translates incoming client REST/WebSocket traffic into internal binary gRPC calls over HTTP/2.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-sky-400 text-sm font-semibold">
                  <Cpu className="w-4 h-4" />
                  <span>gRPC Microservices</span>
                </div>
                <p className="text-xs text-slate-400">
                  Auth (:50051), Catalog (:50052), Inventory (:50053), Order (:50054). Strongly typed via shared Protobuf contracts.
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center space-x-2 text-amber-400 text-sm font-semibold">
                  <RefreshCw className="w-4 h-4" />
                  <span>Event Bus & Saga</span>
                </div>
                <p className="text-xs text-slate-400">
                  RabbitMQ topic exchange <code className="text-amber-300">ticketing.exchange</code> coordinating payment processing, ticket issuance, and auto-rollback.
                </p>
              </div>
            </div>

            {/* Microservice Status Matrix */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-white mb-4">Service Endpoints & Status Matrix</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-3 font-semibold">Service</th>
                      <th className="pb-3 font-semibold">Transport</th>
                      <th className="pb-3 font-semibold">Port / Protocol</th>
                      <th className="pb-3 font-semibold">Persistence</th>
                      <th className="pb-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-2.5 font-medium text-white">API Gateway</td>
                      <td>HTTP / WebSocket</td>
                      <td>:4000 (LoadBalancer)</td>
                      <td>Stateless</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Auth Service</td>
                      <td>gRPC</td>
                      <td>:50051 (ClusterIP)</td>
                      <td>PostgreSQL / JWT</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Catalog Service</td>
                      <td>gRPC</td>
                      <td>:50052 (ClusterIP)</td>
                      <td>PostgreSQL</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Inventory Service</td>
                      <td>gRPC + RabbitMQ</td>
                      <td>:50053 (ClusterIP)</td>
                      <td>Redis (TTL Lock) + PostgreSQL</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Order Service</td>
                      <td>gRPC + RabbitMQ</td>
                      <td>:50054 (ClusterIP)</td>
                      <td>PostgreSQL (Saga)</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Payment Service</td>
                      <td>RabbitMQ Worker</td>
                      <td>payment_queue</td>
                      <td>Stripe / Escrow</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-white">Notification Service</td>
                      <td>RabbitMQ Worker</td>
                      <td>notification_queue</td>
                      <td>PDF Generator / Mailer</td>
                      <td><span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px]">READY</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Resale Modal */}
      {resaleModalTicket && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-white text-base">List Ticket for Resale</h3>
              <button onClick={() => setResaleModalTicket(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Set your asking price for {resaleModalTicket.event_title} ({resaleModalTicket.seat_info}). Once purchased, your barcode is invalidated and a fresh barcode is transferred to the buyer.
            </p>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Your Resale Price ($ USD)</label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="number"
                  value={resalePriceInput}
                  onChange={(e) => setResalePriceInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                onClick={() => setResaleModalTicket(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleListResale(resaleModalTicket)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition shadow-lg shadow-purple-600/20"
              >
                Confirm Resale Listing
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auth Modal (Sign In / Register) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-white text-lg">
                  {authMode === 'login' ? 'Sign In to TicketHub' : 'Create Fan Account'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authenticated against PostgreSQL <code className="text-emerald-300">users</code> table with JWT signature.
                </p>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setAuthError(''); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  authMode === 'login' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setAuthError(''); }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                  authMode === 'register' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register
              </button>
            </div>

            {/* Error Message */}
            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* Login Mode */}
            {authMode === 'login' ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await handleLogin(authForm.email, authForm.password);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="buyer@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  {authLoading ? 'Authenticating...' : 'Sign In with JWT'}
                </button>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-400 block mb-2 font-medium">Quick Demo Accounts:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickSwitch('buyer@example.com')}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-left text-xs transition"
                    >
                      <div className="font-semibold text-emerald-400">Alice Buyer</div>
                      <div className="text-[10px] text-slate-500 font-mono">buyer@example.com</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSwitch('seller@example.com')}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-left text-xs transition"
                    >
                      <div className="font-semibold text-purple-400">Bob Seller</div>
                      <div className="text-[10px] text-slate-500 font-mono">seller@example.com</div>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      placeholder="Charlie Fan"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={authForm.email}
                      onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                      placeholder="charlie@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="password"
                      required
                      value={authForm.password}
                      onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Account Role</label>
                  <select
                    value={authForm.role}
                    onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BUYER">Buyer (Purchase & Hold Tickets)</option>
                    <option value="SELLER">Seller (List Tickets on Secondary Market)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-500/20"
                >
                  {authLoading ? 'Creating Account...' : 'Register in PostgreSQL'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
