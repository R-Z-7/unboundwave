import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  MessageCircle,
  Compass,
  Settings,
  Plus,
  Search,
  ArrowUpRight,
  ArrowRight,
  Lock,
  Globe,
  ChevronDown,
  MoreHorizontal,
  Send,
  Smile,
  Paperclip,
  ShieldCheck,
  Radio,
  Copy,
  X,
  Sun,
  Moon,
  Check,
  LogOut,
  Users,
  Link,
  Download,
  Reply,
  Hash,
  Menu,
} from "lucide-react";
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  nip59,
  protect,
  unlock,
  publicKey,
  type Backup,
} from "./identity";
import {
  pool,
  defaults,
  announce,
  accepted,
  inboxRelays,
  wraps,
} from "./network";
import { finalizeEvent, verifyEvent, type Event } from "nostr-tools";
import QRCode from "qrcode";
import "./style.css";
type Chat = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  preview: string;
  time: string;
  unread?: number;
  public?: boolean;
  relay?: string;
  roomId?: string;
  demo?: boolean;
};
type Msg = {
  id: string;
  chat: string;
  text: string;
  mine: boolean;
  time: number;
  status?: string;
  event?: Event[];
  targets?: string[][];
  reply?: string;
};
const samples: Chat[] = [
  {
    id: "milo",
    name: "Milo Bennett",
    avatar: "MB",
    color: "#a6bba2",
    preview: "That’s exactly what I was thinking.",
    time: "2m",
    unread: 2,
    demo: true,
  },
  {
    id: "ava",
    name: "Ava Chen",
    avatar: "AC",
    color: "#d9a596",
    preview: "You: See you on the other side ✌️",
    time: "18m",
    demo: true,
  },
  {
    id: "studio",
    name: "The open studio",
    avatar: "✳",
    color: "#b3b2d6",
    preview: "Nora: Something I’ve been working on…",
    time: "42m",
    public: true,
    demo: true,
  },
  {
    id: "leo",
    name: "Leo Williams",
    avatar: "LW",
    color: "#d8c493",
    preview: "The internet we actually want.",
    time: "1h",
    demo: true,
  },
  {
    id: "garden",
    name: "Digital gardeners",
    avatar: "❋",
    color: "#b5c99d",
    preview: "Sam: A little less noise, a little more signal.",
    time: "3h",
    public: true,
    demo: true,
  },
];
const rooms = [
  {
    name: "The open studio",
    tag: "DESIGN & CREATIVITY",
    desc: "A space for unfinished ideas, creative experiments, and making things together.",
    icon: "✳",
    members: "128",
    color: "#b3b2d6",
  },
  {
    name: "Digital gardeners",
    tag: "TECH & CULTURE",
    desc: "Cultivating a more thoughtful internet. One conversation at a time.",
    icon: "❋",
    members: "86",
    color: "#b5c99d",
  },
  {
    name: "Off the grid",
    tag: "LIFE & ADVENTURE",
    desc: "Outside is a pretty good place to be. Share your next escape.",
    icon: "↗",
    members: "204",
    color: "#d8c493",
  },
];
const initial: Msg[] = [
  {
    id: "d1",
    chat: "milo",
    text: "Hey! Have you had a chance to explore Unboundwave yet?",
    mine: false,
    time: Date.now() - 1800000,
  },
  {
    id: "d2",
    chat: "milo",
    text: "Just got here. Feels good to have a little corner of the internet that’s actually ours.",
    mine: true,
    time: Date.now() - 1700000,
  },
  {
    id: "d3",
    chat: "milo",
    text: "Right? No algorithms, no noise. Just people.",
    mine: false,
    time: Date.now() - 1500000,
  },
  {
    id: "d4",
    chat: "milo",
    text: "Also, you should check out The open studio. A few of us are sharing what we’re working on there.",
    mine: false,
    time: Date.now() - 1450000,
  },
  {
    id: "d5",
    chat: "milo",
    text: "I’m in. More making, less scrolling 🙌",
    mine: true,
    time: Date.now() - 1300000,
  },
  {
    id: "d6",
    chat: "milo",
    text: "That’s exactly what I was thinking.",
    mine: false,
    time: Date.now() - 120000,
  },
];
function App() {
  const [page, setPage] = useState("landing"),
    [chats, setChats] = useState<Chat[]>(samples),
    [active, setActive] = useState("milo"),
    [messages, setMessages] = useState<Msg[]>(initial),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState(""),
    [modal, setModal] = useState(""),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [secret, setSecret] = useState<Uint8Array | null>(null),
    [name, setName] = useState("Alex Morgan"),
    [recovery, setRecovery] = useState(""),
    [npub, setNpub] = useState(""),
    [backup, setBackup] = useState<Backup | null>(() =>
      JSON.parse(localStorage.getItem("unbound-backup") || "null"),
    ),
    [relays, setRelays] = useState<string[]>(
      () =>
        JSON.parse(localStorage.getItem("unbound-relays") || "null") ||
        defaults,
    ),
    [relayInput, setRelayInput] = useState(""),
    [health, setHealth] = useState<Record<string, boolean>>({}),
    [online, setOnline] = useState(navigator.onLine),
    [light, setLight] = useState(false),
    [qr, setQr] = useState(""),
    [reply, setReply] = useState<Msg | null>(null),
    [blocked, setBlocked] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("unbound-blocked") || "[]"),
    ),
    [muted, setMuted] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("unbound-muted") || "[]"),
    ),
    [mobile, setMobile] = useState(false),
    [discovered, setDiscovered] = useState<Chat[]>([]);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [googleConfigured, setGoogleConfigured] = useState(false);
  const [account, setAccount] = useState(false);
  const busy = useRef(false),
    end = useRef<HTMLDivElement>(null);
  const current = chats.find((c) => c.id === active) || chats[0];
  const myPub = secret ? getPublicKey(secret) : "";
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then(async (data) => {
        setGoogleConfigured(!!data.googleConfigured);
        if (data.user) {
          setAccount(true);
          const p = await fetch("/api/profile").then((r) => r.json());
          if (p.displayName) setName(p.displayName);
          if (p.backup) {
            setBackup(p.backup);
            localStorage.setItem("unbound-backup", JSON.stringify(p.backup));
          }
          show("identity");
        }
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (account && backup)
      fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, backup }),
      }).catch(() =>
        notice("Account backup sync failed. Keep a local export."),
      );
  }, [account, backup, name]);
  useEffect(() => {
    localStorage.setItem("unbound-blocked", JSON.stringify(blocked));
    localStorage.setItem("unbound-muted", JSON.stringify(muted));
  }, [blocked, muted]);
  useEffect(() => {
    if (!modal) return;
    const previous = document.activeElement as HTMLElement;
    const dialog = document.querySelector<HTMLElement>(".modal")!;
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button,a[href],input,select,textarea",
        ),
      );
    focusables()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables(),
        first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal]);
  function notice(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 4000);
  }
  function show(m: string) {
    setError("");
    setModal(m);
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal("");
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search input")?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  useEffect(() => {
    const yes = () => setOnline(true),
      no = () => setOnline(false);
    window.addEventListener("online", yes);
    window.addEventListener("offline", no);
    return () => {
      window.removeEventListener("online", yes);
      window.removeEventListener("offline", no);
    };
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, active]);
  useEffect(() => {
    let alive = true;
    const check = () =>
      relays.forEach(async (r) => {
        try {
          await pool.ensureRelay(r);
          if (alive) setHealth((h) => ({ ...h, [r]: true }));
        } catch {
          if (alive) setHealth((h) => ({ ...h, [r]: false }));
        }
      });
    check();
    const timer = setInterval(check, 30000);
    localStorage.setItem("unbound-relays", JSON.stringify(relays));
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [relays]);
  useEffect(() => {
    if (!secret) return;
    announce(secret, relays).catch(() =>
      notice("Inbox announcement failed. Check your relays."),
    );
    const sub = pool.subscribeMany(
      relays,
      { kinds: [1059], "#p": [myPub] },
      {
        onevent: (ev) => {
          try {
            if (!verifyEvent(ev)) return;
            const rum = nip59.unwrapEvent(ev, secret);
            if (
              rum.kind !== 14 ||
              (!rum.tags.some((t) => t[0] === "p" && t[1] === myPub) &&
                rum.pubkey !== myPub)
            )
              return;
            const peer =
              rum.pubkey === myPub
                ? rum.tags.find((t) => t[0] === "p")?.[1]
                : rum.pubkey;
            if (!peer || blocked.includes(peer)) return;
            setChats((cs) =>
              cs.some((c) => c.id === peer)
                ? cs
                : [
                    {
                      id: peer,
                      name: nip19.npubEncode(peer).slice(0, 16) + "…",
                      avatar: "?",
                      color: "#a6bba2",
                      preview: rum.content,
                      time: "now",
                    },
                    ...cs,
                  ],
            );
            setMessages((ms) =>
              ms.some((m) => m.id === rum.id)
                ? ms
                : [
                    ...ms,
                    {
                      id: rum.id,
                      chat: peer,
                      text: rum.content,
                      mine: rum.pubkey === myPub,
                      time: rum.created_at * 1000,
                      status:
                        rum.pubkey === myPub ? "accepted by relay" : undefined,
                    },
                  ],
            );
          } catch {
            /* Reject malformed or unauthenticated events without logging. */
          }
        },
      },
    );
    return () => sub.close();
  }, [secret, relays, blocked]);
  useEffect(() => {
    if (!secret) return;
    const live = messages.filter(
      (m) => !chats.find((c) => c.id === m.chat)?.demo,
    );
    protect(
      new TextEncoder().encode(
        JSON.stringify({ messages: live, chats: chats.filter((c) => !c.demo) }),
      ),
      nip19.nsecEncode(secret),
    ).then((v) => localStorage.setItem("unbound-history", JSON.stringify(v)));
  }, [messages, chats, secret, backup]);
  async function activate(sk: Uint8Array) {
    setSecret(sk);
    setModal("");
    setPage("chats");
    try {
      const cached = localStorage.getItem("unbound-history");
      if (cached) {
        const saved = JSON.parse(
          new TextDecoder().decode(
            await unlock(JSON.parse(cached), nip19.nsecEncode(sk)),
          ),
        );
        setMessages(
          saved.messages.map((m: Msg) => ({
            ...m,
            status: m.status === "sending" ? "queued" : m.status,
          })),
        );
        setChats(saved.chats.length ? saved.chats : samples);
      }
    } catch {
      notice("No history could be unlocked for this identity.");
    }
  }
  async function createIdentity() {
    try {
      const sk = generateSecretKey();
      const b = await protect(sk, recovery);
      localStorage.setItem("unbound-backup", JSON.stringify(b));
      setBackup(b);
      await activate(sk);
      notice("Identity created. Keep your recovery secret safe.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function recover() {
    try {
      if (recovery.startsWith("nsec")) {
        const decoded = nip19.decode(recovery);
        if (decoded.type !== "nsec") throw Error("Invalid recovery key");
        await activate(decoded.data);
      } else {
        if (!backup)
          throw Error(
            "Import an encrypted backup first, or enter an nsec key.",
          );
        await activate(await unlock(backup, recovery));
      }
    } catch {
      setError("Unable to unlock identity. Check your secret and backup.");
    }
  }
  async function flush() {
    if (busy.current || !online || !secret) return;
    busy.current = true;
    try {
      for (const m of messages.filter((m) => m.status === "queued")) {
        setMessages((ms) =>
          ms.map((x) => (x.id === m.id ? { ...x, status: "sending" } : x)),
        );
        try {
          let events = m.event,
            targets = m.targets;
          if (!events) {
            const recipientRelays = await inboxRelays(m.chat, relays);
            if (!recipientRelays.length)
              throw Error("Recipient has not advertised an inbox.");
            events = wraps(secret, m.chat, m.text, m.reply, m.time);
            targets = [recipientRelays, relays];
            setMessages((ms) =>
              ms.map((x) =>
                x.id === m.id ? { ...x, event: events, targets } : x,
              ),
            );
          }
          await Promise.all(events.map((ev, i) => accepted(targets![i], ev)));
          setMessages((ms) =>
            ms.map((x) =>
              x.id === m.id ? { ...x, status: "accepted by relay" } : x,
            ),
          );
        } catch {
          setMessages((ms) =>
            ms.map((x) => (x.id === m.id ? { ...x, status: "failed" } : x)),
          );
          notice(
            "Message failed. The recipient needs an inbox and reachable relays.",
          );
        }
      }
    } finally {
      busy.current = false;
    }
  }
  useEffect(() => {
    void flush();
  }, [messages, online, secret]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    if (current.demo) {
      notice(
        "Preview conversation. Connect your identity and add a contact to send real messages.",
      );
      return;
    }
    if (!secret) {
      show("identity");
      return;
    }
    if (blocked.includes(active)) {
      notice("Unblock this contact before sending.");
      return;
    }
    if (
      messages.filter((m) => m.mine && m.time > Date.now() - 60000).length >= 20
    ) {
      notice("Please wait a moment before sending more messages.");
      return;
    }
    if (current.public) {
      try {
        const ev = finalizeEvent(
          {
            kind: 9,
            content: draft.trim(),
            created_at: Math.floor(Date.now() / 1000),
            tags: [["h", current.roomId || active]],
          },
          secret,
        );
        await accepted([current.relay!], ev);
        setMessages((ms) => [
          ...ms,
          {
            id: ev.id,
            chat: active,
            text: draft,
            mine: true,
            time: Date.now(),
            status: "accepted by relay",
          },
        ]);
        setDraft("");
      } catch {
        notice("Room relay rejected this message. Membership may be required.");
      }
      return;
    }
    setMessages((ms) => [
      ...ms,
      {
        id: nip59.createRumor(
          {
            kind: 14,
            content: draft.trim(),
            tags: [["p", active], ...(reply ? [["e", reply.id]] : [])],
            created_at: Math.floor(Date.now() / 1000),
          },
          secret,
        ).id,
        chat: active,
        text: draft.trim(),
        mine: true,
        time: Date.now(),
        status: "queued",
        reply: reply?.id,
      },
    ]);
    setDraft("");
    setReply(null);
  }
  async function addContact() {
    try {
      const id = publicKey(npub.trim());
      setChats((cs) =>
        cs.some((c) => c.id === id)
          ? cs
          : [
              {
                id,
                name: npub.slice(0, 18) + "…",
                avatar: "N",
                color: "#c2b59b",
                preview: "Start a conversation",
                time: "now",
              },
              ...cs,
            ],
      );
      setActive(id);
      setPage("chats");
      setModal("");
    } catch {
      setError("Enter a valid public npub or hexadecimal identity.");
    }
  }
  async function share() {
    if (!secret) {
      show("identity");
      return;
    }
    const url = location.origin + "/?contact=" + nip19.npubEncode(myPub);
    setQr(
      await QRCode.toDataURL(url, {
        color: { dark: "#171918", light: "#faf7ef" },
      }),
    );
    show("share");
  }
  async function discover() {
    setPage("rooms");
    const results = await Promise.allSettled(
      relays.map(async (relay) => {
        const info = await fetch(relay.replace("wss:", "https:"), {
          headers: { Accept: "application/nostr+json" },
        }).then((r) => r.json());
        if (!info.pubkey || !info.supported_nips?.includes(29)) return [];
        const events = await pool.querySync([relay], {
          kinds: [39000],
          authors: [info.pubkey],
          limit: 40,
        });
        const latest = new Map<string, Event>();
        for (const e of events) {
          const d = e.tags.find((t) => t[0] === "d")?.[1];
          if (
            d &&
            verifyEvent(e) &&
            (!latest.has(d) || latest.get(d)!.created_at < e.created_at)
          )
            latest.set(d, e);
        }
        return [...latest.entries()]
          .filter(
            ([, e]) =>
              e.tags.some((t) => t[0] === "public") &&
              !e.tags.some((t) => t[0] === "private"),
          )
          .map(([id, e]) => ({
            id: relay + "|" + id,
            roomId: id,
            name: e.tags.find((t) => t[0] === "name")?.[1] || "Community",
            avatar: "#",
            color: "#b5c99d",
            preview:
              e.tags.find((t) => t[0] === "about")?.[1] ||
              "Public relay community",
            time: "",
            public: true,
            relay,
          }));
      }),
    );
    setDiscovered(
      results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])),
    );
  }
  async function join(c: Chat) {
    if (!secret) {
      show("identity");
      return;
    }
    try {
      await accepted(
        [c.relay!],
        finalizeEvent(
          {
            kind: 9021,
            content: "",
            tags: [["h", c.roomId || c.id]],
            created_at: Math.floor(Date.now() / 1000),
          },
          secret,
        ),
      );
      setChats((cs) => (cs.some((x) => x.id === c.id) ? cs : [c, ...cs]));
      setActive(c.id);
      setPage("chats");
      notice("Join request accepted by relay.");
    } catch {
      notice("Join request rejected or pending relay approval.");
    }
  }
  useEffect(() => {
    if (!current?.public || current.demo || !current.relay) return;
    const sub = pool.subscribeMany(
      [current.relay],
      { kinds: [9], "#h": [current.roomId || current.id], limit: 100 },
      {
        onevent: (ev) => {
          if (!verifyEvent(ev)) return;
          setMessages((ms) =>
            ms.some((m) => m.id === ev.id)
              ? ms
              : [
                  ...ms,
                  {
                    id: ev.id,
                    chat: current.id,
                    text: ev.content,
                    mine: ev.pubkey === myPub,
                    time: ev.created_at * 1000,
                  },
                ],
          );
        },
      },
    );
    return () => sub.close();
  }, [active, chats, myPub]);
  useEffect(() => {
    const contact = new URLSearchParams(location.search).get("contact");
    if (contact) {
      setNpub(contact);
      show("contact");
    }
    if ("serviceWorker" in navigator && import.meta.env.PROD)
      navigator.serviceWorker.register("/sw.js");
  }, []);
  const icon = (Icon: typeof MessageCircle) => (
    <Icon size={20} strokeWidth={1.7} />
  );
  return (
    <div
      className={`app ${page === "landing" && !secret ? "welcome" : ""} ${mobile ? "mobile-list" : ""}`}
    >
      <aside className="rail">
        <a
          className="brand"
          href="#home"
          onClick={() => setPage("landing")}
          aria-label="Unboundwave home"
        >
          <span className="mark">
            u<span>↗</span>
          </span>
          <b>
            unboundwave<span className="brand-dot">.</span>
          </b>
        </a>
        <div className="workspace">
          <span className="workspace-icon">U</span>
          <div>
            My space<small>Your little corner.</small>
          </div>
          <ChevronDown size={16} />
        </div>
        <div className="nav-label">YOUR NETWORK</div>
        <nav>
          {[
            ["chats", "Chats", MessageCircle],
            ["rooms", "Discover rooms", Compass],
            ["requests", "Message requests", ShieldCheck],
          ].map(([p, label, I]) => (
            <button
              key={p as string}
              onClick={() =>
                p === "rooms" ? void discover() : setPage(p as string)
              }
              className={page === p ? "selected" : ""}
            >
              {icon(I as typeof MessageCircle)}
              <span>{label as string}</span>
              {p === "chats" && <em>2</em>}
              {p === "requests" && <span className="tiny-dot" />}
            </button>
          ))}
        </nav>
        <div className="room-nav">
          <div className="nav-label">
            YOUR ROOMS
            <button aria-label="Add room" onClick={() => show("room")}>
              <Plus size={15} />
            </button>
          </div>
          {chats
            .filter((c) => c.public)
            .map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActive(c.id);
                  setPage("chats");
                }}
              >
                <Hash size={17} />
                {c.name}
              </button>
            ))}
          <button className="browse" onClick={() => void discover()}>
            <Plus size={16} /> Find your people
          </button>
        </div>
        <div className="rail-bottom">
          <div className="network-box">
            <span className="signal">
              <Radio size={16} />
            </span>
            <div>
              Your network, alive.
              <small>
                {online
                  ? `${Object.values(health).filter(Boolean).length} relays connected`
                  : "Offline · messages stay queued"}
              </small>
            </div>
            <span
              className={
                Object.values(health).some(Boolean) ? "green-dot" : "tiny-dot"
              }
            />
          </div>
          <button className="settings-nav" onClick={() => setPage("settings")}>
            {icon(Settings)} Settings & privacy
          </button>
          <button className="account" onClick={() => show("identity")}>
            <span className="avatar self">
              {name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div>
              {name}
              <small>{secret ? "Identity connected" : "Explore mode"}</small>
            </div>
            <MoreHorizontal size={19} />
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <button
              className="mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Toggle conversations"
            >
              <Menu size={20} />
            </button>
            <select
              className="mobile-page-select"
              aria-label="Navigate"
              value={page}
              onChange={(e) =>
                e.target.value === "rooms"
                  ? void discover()
                  : setPage(e.target.value)
              }
            >
              <option value="chats">Chats</option>
              <option value="rooms">Rooms</option>
              <option value="requests">Requests</option>
              <option value="settings">Settings</option>
              <option value="landing">Home</option>
            </select>
            <span className="breadcrumb">My space</span>
            <span className="slash">/</span>
            {page === "landing"
              ? "Welcome to Unboundwave"
              : page === "rooms"
                ? "Discover rooms"
                : page === "settings"
                  ? "Settings & privacy"
                  : page === "requests"
                    ? "Message requests"
                    : "Chats"}
          </div>
          <div className="top-actions">
            <span>
              <Lock size={13} /> Your voice. Your network.
            </span>
            <button
              onClick={() => setLight(!light)}
              aria-label="Toggle color theme"
            >
              {light ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            {!secret ? (
              <>
                <button
                  className="auth-login"
                  onClick={() => {
                    setAuthMode("login");
                    show("identity");
                  }}
                >
                  Log in
                </button>
                <button
                  className="primary auth-signup"
                  onClick={() => {
                    setAuthMode("signup");
                    show("identity");
                  }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <button className="invite" onClick={() => void share()}>
                <Plus size={15} /> Invite a friend
              </button>
            )}
          </div>
        </header>
        {page === "landing" ? (
          <section className="landing">
            <div className="eyebrow">
              <span className="orange-dot" /> OPEN SOURCE. OPEN POSSIBILITIES.
            </div>
            <div className="landing-symbol">
              u<span>↗</span>
            </div>
            <h1>
              Your voice.
              <br />
              <span>Your network.</span>
            </h1>
            <p>
              The internet was meant to bring us together.
              <br />
              Let’s make a little space for that again.
            </p>
            <div className="landing-buttons">
              <button
                className="primary"
                onClick={() => {
                  setAuthMode("signup");
                  show("identity");
                }}
              >
                Sign up <ArrowUpRight size={18} />
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setAuthMode("login");
                  show("identity");
                }}
              >
                Log in
              </button>
              <button
                className="landing-preview"
                onClick={() => setPage("chats")}
              >
                Explore a preview <ArrowRight size={15} />
              </button>
            </div>
            <div className="landing-features">
              <div>
                <Lock />
                <b>Just between you.</b>
                <p>Device-encrypted direct messages.</p>
              </div>
              <div>
                <Globe />
                <b>Find your people.</b>
                <p>Open, public community spaces.</p>
              </div>
              <div>
                <Radio />
                <b>Keep your independence.</b>
                <p>Your identity. Multiple relays.</p>
              </div>
            </div>
          </section>
        ) : page === "chats" ? (
          <div className="chat-layout">
            <section className="chat-list">
              <div className="list-heading">
                <h1>
                  Chats<span>05</span>
                </h1>
                <button
                  className="square"
                  onClick={() => show("contact")}
                  aria-label="New conversation"
                >
                  <Plus size={19} />
                </button>
              </div>
              <label className="search">
                <Search size={16} />
                <input
                  placeholder="Search your conversations"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>⌘ K</kbd>
              </label>
              <div className="tabs">
                <button className="active" onClick={() => setQuery("")}>
                  All chats
                </button>
                <button onClick={() => setQuery("unread")}>
                  Unread <span>1</span>
                </button>
                <button onClick={() => setQuery("public")}>Rooms</button>
              </div>
              <div className="chat-entries">
                {chats
                  .filter((c) =>
                    query === "unread"
                      ? !!c.unread
                      : query === "public"
                        ? c.public
                        : c.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((c) => (
                    <button
                      key={c.id}
                      className={`chat-entry ${active === c.id ? "active" : ""}`}
                      onClick={() => {
                        setActive(c.id);
                        setMobile(false);
                        setChats((cs) =>
                          cs.map((x) =>
                            x.id === c.id ? { ...x, unread: undefined } : x,
                          ),
                        );
                      }}
                    >
                      <span className="avatar" style={{ background: c.color }}>
                        {c.avatar}
                      </span>
                      <div className="chat-copy">
                        <div>
                          <b>{c.name}</b>
                          <time>{c.time}</time>
                        </div>
                        <p>{c.preview}</p>
                        {c.public && (
                          <small>
                            <Globe size={10} /> Public room
                          </small>
                        )}
                      </div>
                      {c.unread && <em>{c.unread}</em>}
                    </button>
                  ))}
              </div>
              <div className="list-footer">
                <div className="line-art">✳</div>
                <b>
                  Good conversations.
                  <br />
                  No strings attached.
                </b>
                <p>A space that belongs to you.</p>
                <a onClick={() => show("about")}>
                  Meet Unboundwave <ArrowUpRight size={13} />
                </a>
              </div>
            </section>
            <section className="conversation">
              <div className="conversation-header">
                <span className="avatar" style={{ background: current.color }}>
                  {current.avatar}
                </span>
                <div>
                  <h2>{current.name}</h2>
                  <span>
                    {current.public ? (
                      <>
                        <Globe size={12} /> Public room · everyone can read
                      </>
                    ) : (
                      <>
                        <Lock size={12} />
                        {current.demo
                          ? "Preview conversation"
                          : "End-to-end encrypted"}
                      </>
                    )}
                  </span>
                </div>
                <div className="conversation-actions">
                  <button
                    aria-label="Search conversation"
                    onClick={() => show("search")}
                  >
                    <Search size={19} />
                  </button>
                  <button
                    aria-label="Conversation options"
                    onClick={() => show("options")}
                  >
                    <MoreHorizontal size={21} />
                  </button>
                </div>
              </div>
              <div className="encryption-strip">
                <ShieldCheck size={14} />
                {current.demo
                  ? "You’re exploring a sample conversation. Connect an identity to chat for real."
                  : current.public
                    ? "Public means public. Messages are visible to the relay and other people."
                    : "Just between you. Messages are encrypted on your device."}
                <button onClick={() => show("about")}>
                  Learn more <ArrowUpRight size={11} />
                </button>
              </div>
              <div className="message-area">
                <div className="conversation-start">
                  <span className="start-icon">
                    <MessageCircle size={23} />
                  </span>
                  <h3>
                    A little less noise.
                    <br />A little more connection.
                  </h3>
                  <p>
                    This is the start of your conversation with{" "}
                    {current.name.split(" ")[0]}.
                  </p>
                </div>
                <div className="day-divider">
                  <span />
                  {new Date().toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })}
                  <span />
                </div>
                {messages
                  .filter((m) => m.chat === active)
                  .sort((a, b) => a.time - b.time)
                  .map((m, i) => (
                    <div
                      key={m.id}
                      className={`message ${m.mine ? "mine" : ""}`}
                    >
                      <span
                        className="message-avatar"
                        style={{ background: current.color }}
                      >
                        {m.mine ? "" : current.avatar}
                      </span>
                      <div>
                        {!m.mine && (
                          <b className="sender-name">
                            {current.name.split(" ")[0]}
                          </b>
                        )}
                        <div className="bubble">
                          {m.reply && (
                            <small className="reply-reference">
                              Replying to an earlier message
                            </small>
                          )}
                          {m.text}
                        </div>
                        <div className="message-meta">
                          <time>
                            {new Date(m.time).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          {m.mine && (
                            <span>
                              {current.demo ? "Preview" : m.status}{" "}
                              {m.status === "accepted by relay" && (
                                <Check size={11} />
                              )}
                            </span>
                          )}
                          {m.status === "failed" && (
                            <button
                              onClick={() =>
                                setMessages((ms) =>
                                  ms.map((x) =>
                                    x.id === m.id
                                      ? { ...x, status: "queued" }
                                      : x,
                                  ),
                                )
                              }
                            >
                              Retry
                            </button>
                          )}
                          <button
                            aria-label="Reply"
                            onClick={() => setReply(m)}
                          >
                            <Reply size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                <div ref={end} />
              </div>
              <div className="compose-wrapper">
                {reply && (
                  <div className="reply-banner">
                    Replying: {reply.text.slice(0, 70)}
                    <button onClick={() => setReply(null)}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                <form className="composer" onSubmit={send}>
                  <button
                    type="button"
                    aria-label="Attachment information"
                    onClick={() =>
                      notice(
                        "Encrypted attachments are planned for a later release.",
                      )
                    }
                  >
                    <Plus size={21} />
                  </button>
                  <input
                    value={draft}
                    maxLength={4000}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={`Message ${current.name.split(" ")[0]}…`}
                    aria-label="Message"
                  />
                  <button
                    type="button"
                    aria-label="Add emoji"
                    onClick={() => setDraft((d) => d + " ✨")}
                  >
                    <Smile size={21} />
                  </button>
                  <button
                    type="submit"
                    className="send"
                    aria-label="Send message"
                  >
                    <ArrowUpRight size={22} />
                  </button>
                </form>
                <div className="compose-note">
                  <span>
                    <Lock size={10} />
                    {current.public ? "Public community" : "Private by design."}
                  </span>
                  <span>
                    Enter to send <span className="key-symbol">↵</span>
                  </span>
                </div>
              </div>
            </section>
          </div>
        ) : page === "rooms" ? (
          <section className="discover-page">
            <div className="eyebrow">
              <span className="orange-dot" /> FIND YOUR PEOPLE
            </div>
            <div className="page-heading">
              <div>
                <h1>
                  Less noise.
                  <br />
                  <span>More belonging.</span>
                </h1>
                <p>
                  Little corners of the internet. Big conversations.
                  <br />
                  Find a room that feels like you.
                </p>
              </div>
              <button className="primary" onClick={() => show("room")}>
                <Plus size={17} /> Create a room
              </button>
            </div>
            <div className="discovery-banner">
              <Globe size={18} />
              <div>
                <b>Open doors. Open conversations.</b>
                <p>
                  Community rooms are public. Private conversations belong in
                  your chats.
                </p>
              </div>
              <span>
                PUBLIC BY DESIGN <ArrowUpRight size={16} />
              </span>
            </div>
            <div className="section-heading">
              <h2>Worth a conversation</h2>
              <span>Curated preview rooms</span>
            </div>
            <div className="room-cards">
              {rooms.map((r, i) => (
                <article className="room-card" key={r.name}>
                  <div className="room-art" style={{ background: r.color }}>
                    <span>{r.icon}</span>
                    <i>0{i + 1}</i>
                    <div className="art-caption">
                      A SPACE TO{" "}
                      {i === 0 ? "MAKE" : i === 1 ? "GROW" : "WANDER"}.
                    </div>
                  </div>
                  <div className="room-card-body">
                    <div className="eyebrow">{r.tag}</div>
                    <h3>{r.name}</h3>
                    <p>{r.desc}</p>
                    <footer>
                      <span>
                        <Users size={14} /> {r.members} people · Preview
                      </span>
                      <button
                        aria-label={`Preview ${r.name}`}
                        onClick={() => {
                          setActive(
                            i === 0 ? "studio" : i === 1 ? "garden" : "studio",
                          );
                          setPage("chats");
                        }}
                      >
                        <ArrowUpRight size={21} />
                      </button>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
            <div className="section-heading">
              <h2>From the network</h2>
              <button onClick={() => void discover()}>
                Refresh <Radio size={14} />
              </button>
            </div>
            {discovered.length ? (
              discovered.map((c) => (
                <div className="network-room" key={c.id}>
                  <Hash />
                  <div>
                    <b>{c.name}</b>
                    <p>{c.preview}</p>
                  </div>
                  <button className="secondary" onClick={() => void join(c)}>
                    Request to join
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-network">
                <Radio size={23} />
                <p>No public communities found on your current relays.</p>
                <button onClick={() => setPage("settings")}>
                  Add a NIP-29 relay <ArrowRight size={14} />
                </button>
              </div>
            )}
          </section>
        ) : page === "settings" ? (
          <section className="settings-page">
            <div className="eyebrow">MAKE YOURSELF AT HOME</div>
            <h1>Your space. Your rules.</h1>
            <p>Take control of your identity, privacy, and network.</p>
            <div className="settings-grid">
              <article>
                <h2>
                  <ShieldCheck /> Identity & recovery
                </h2>

                <label>
                  Display name
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>

                <p>
                  Google restores account access. Your separate recovery secret
                  unlocks messaging keys.
                </p>
                <button className="primary" onClick={() => show("identity")}>
                  {secret ? "Manage identity" : "Connect your identity"}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    if (!backup) {
                      notice("Create an identity first.");
                      return;
                    }
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(
                      new Blob([JSON.stringify(backup)], {
                        type: "application/json",
                      }),
                    );
                    a.download = "unboundwave-encrypted-backup.json";
                    a.click();
                  }}
                >
                  Export encrypted backup
                </button>
                <label className="file-label">
                  Import encrypted backup
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      try {
                        const v = JSON.parse(await e.target.files![0].text());
                        if (!v.salt || !v.iv || !v.data) throw Error();
                        localStorage.setItem(
                          "unbound-backup",
                          JSON.stringify(v),
                        );
                        setBackup(v);
                        notice(
                          "Backup imported. Enter your recovery secret to unlock.",
                        );
                      } catch {
                        notice("Invalid backup file.");
                      }
                    }}
                  />
                </label>
              </article>
              <article>
                <h2>
                  <Radio /> Relay connections
                </h2>
                <p>
                  Independent relays carry encrypted events. A connected relay
                  does not prove recipient delivery.
                </p>
                {relays.map((r) => (
                  <div className="relay-row" key={r}>
                    <span className={health[r] ? "green-dot" : "tiny-dot"} />
                    <span>
                      {r.replace("wss://", "")}
                      <small>
                        {health[r] ? "Connected" : "Connecting / unavailable"}
                      </small>
                    </span>
                    <button
                      aria-label={`Remove ${r}`}
                      onClick={() =>
                        setRelays((rs) => rs.filter((x) => x !== r))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    try {
                      const u = new URL(relayInput);
                      if (u.protocol !== "wss:") throw Error();
                      setRelays((rs) => [...new Set([...rs, u.href])]);
                      setRelayInput("");
                    } catch {
                      notice("Use a valid wss:// relay URL.");
                    }
                  }}
                >
                  <input
                    placeholder="wss://your-relay.example"
                    value={relayInput}
                    onChange={(e) => setRelayInput(e.target.value)}
                  />
                  <button className="secondary">Add relay</button>
                </form>
              </article>
              <article>
                <h2>
                  <Lock /> Privacy on this device
                </h2>
                <p>
                  Private history and the outbox are encrypted locally using
                  your messaging identity. Unlock after each reload. Browser
                  compromise can expose an unlocked session.
                </p>
                <button
                  className="secondary"
                  onClick={() => {
                    localStorage.removeItem("unbound-history");
                    setMessages([]);
                    notice(
                      "Local history cleared. Relay and recipient copies remain.",
                    );
                  }}
                >
                  Clear local history
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setSecret(null);
                    setMessages(initial);
                    setChats(samples);
                    notice(
                      "Identity locked. Encrypted backup remains on this device.",
                    );
                  }}
                >
                  Lock identity
                </button>
              </article>
              <article>
                <h2>
                  <Sun /> Appearance
                </h2>
                <p>
                  A little light, or a little dark. Make yourself comfortable.
                </p>
                <button className="secondary" onClick={() => setLight(!light)}>
                  {light ? "Switch to dark" : "Switch to light"} mode
                </button>
                <p>
                  Read receipts are not sent. Relay acceptance never means a
                  message has been read.
                </p>
              </article>
            </div>
          </section>
        ) : (
          <section className="requests-page">
            <ShieldCheck size={38} />
            <h1>A little peace of mind.</h1>
            <p>
              New contacts appear here until you choose to start a conversation.
            </p>
            {chats
              .filter(
                (c) =>
                  !c.demo && !messages.some((m) => m.chat === c.id && m.mine),
              )
              .map((c) => (
                <div className="network-room" key={c.id}>
                  <div>
                    <b>{c.name}</b>
                    <p>New contact request</p>
                  </div>
                  <button
                    onClick={() => {
                      setActive(c.id);
                      setPage("chats");
                    }}
                  >
                    Open
                  </button>
                  <button onClick={() => setBlocked((bs) => [...bs, c.id])}>
                    Block
                  </button>
                </div>
              ))}
          </section>
        )}
      </main>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {!online && (
        <div className="offline-pill">
          Offline · messages will queue on this device
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal("")}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={modal}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setModal("")}
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <span className="modal-mark">u↗</span>
            {modal === "identity" ? (
              <>
                <div className="eyebrow">YOUR VOICE. YOUR NETWORK.</div>
                <h2>
                  {authMode === "login" ? "Welcome back." : "Make it your own."}
                </h2>
                <p>
                  One identity. An open network. Conversations that belong to
                  you.
                </p>
                {googleConfigured ? (
                  <a className="google-button" href="/api/auth/google">
                    <b>G</b> Continue with Google <ArrowRight size={17} />
                  </a>
                ) : (
                  <>
                    <button className="google-button" disabled>
                      <b>G</b> Continue with Google
                    </button>
                    <small className="fine-print">
                      Google sign-in is not configured yet. Use your independent
                      identity below.
                    </small>
                  </>
                )}
                <div className="or">or use your independent identity</div>
                {authMode === "signup" && (
                  <label>
                    Display name
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Recovery secret or existing nsec key
                  <input
                    type="password"
                    value={recovery}
                    onChange={(e) => setRecovery(e.target.value)}
                    placeholder={
                      authMode === "signup"
                        ? "At least 16 characters for a new identity"
                        : "Your recovery secret or nsec key"
                    }
                    autoComplete="off"
                  />
                </label>
                <button
                  className="primary"
                  onClick={() =>
                    authMode === "signup"
                      ? void createIdentity()
                      : void recover()
                  }
                >
                  {authMode === "signup"
                    ? "Create your identity"
                    : "Log in and unlock identity"}
                  <ArrowUpRight size={17} />
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setAuthMode(authMode === "signup" ? "login" : "signup");
                    setError("");
                  }}
                >
                  {authMode === "signup"
                    ? "Already have an identity? Log in"
                    : "New here? Sign up"}
                </button>
                <small className="fine-print">
                  Store your recovery secret separately. Google sign-in alone
                  cannot decrypt your backup. Keys are generated on this device.
                </small>
              </>
            ) : modal === "contact" ? (
              <>
                <h2>Start a conversation.</h2>
                <p>
                  Paste a friend’s public Nostr identity. Their email stays
                  private.
                </p>
                <label>
                  Public identity
                  <input
                    value={npub}
                    onChange={(e) => setNpub(e.target.value)}
                    placeholder="npub1…"
                  />
                </label>
                <button className="primary" onClick={() => void addContact()}>
                  Add contact <ArrowRight size={17} />
                </button>
              </>
            ) : modal === "share" ? (
              <>
                <h2>Your people, closer.</h2>
                <p>
                  Share your public identity. Compare this QR code in person to
                  verify a contact.
                </p>
                <img
                  className="qr"
                  src={qr}
                  alt="Public identity invitation QR code"
                />
                <code>{nip19.npubEncode(myPub)}</code>
                <button
                  className="primary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      location.origin + "/?contact=" + nip19.npubEncode(myPub),
                    );
                    notice("Profile invitation copied.");
                  }}
                >
                  <Copy size={16} /> Copy invite link
                </button>
                <small>
                  Profile links do not expire. They contain your public
                  identity, never your private key.
                </small>
              </>
            ) : modal === "options" ? (
              <>
                <h2>Conversation controls</h2>
                <button
                  className="secondary"
                  onClick={() => {
                    setMuted((ms) =>
                      ms.includes(active)
                        ? ms.filter((x) => x !== active)
                        : [...ms, active],
                    );
                    notice("Notification preference updated.");
                    setModal("");
                  }}
                >
                  {muted.includes(active) ? "Unmute" : "Mute"} conversation
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setBlocked((bs) =>
                      bs.includes(active)
                        ? bs.filter((x) => x !== active)
                        : [...bs, active],
                    );
                    setModal("");
                  }}
                >
                  {blocked.includes(active) ? "Unblock" : "Block"} contact
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    setQr(await QRCode.toDataURL(active));
                    setModal("verify");
                  }}
                >
                  Verify contact identity
                </button>
                {current.public && !current.demo && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      if (!secret) return;
                      try {
                        await accepted(
                          [current.relay!],
                          finalizeEvent(
                            {
                              kind: 9022,
                              content: "",
                              tags: [["h", current.roomId || active]],
                              created_at: Math.floor(Date.now() / 1000),
                            },
                            secret,
                          ),
                        );
                        setChats((cs) => cs.filter((c) => c.id !== active));
                        setActive("milo");
                        setModal("");
                      } catch {
                        setError("Relay rejected leave request.");
                      }
                    }}
                  >
                    Leave room
                  </button>
                )}
              </>
            ) : modal === "verify" ? (
              <>
                <h2>Compare identities.</h2>
                <p>
                  Compare this QR code and public key with your contact on a
                  trusted channel. A matching name is not proof of identity.
                </p>
                <img
                  className="qr"
                  src={qr}
                  alt="Contact identity verification QR"
                />
                <code>{active}</code>
              </>
            ) : modal === "search" ? (
              <>
                <h2>Find in conversation</h2>
                <input
                  placeholder="Search messages"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {messages
                  .filter(
                    (m) =>
                      m.chat === active &&
                      query &&
                      m.text.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((m) => (
                    <p key={m.id}>{m.text}</p>
                  ))}
              </>
            ) : modal === "room" ? (
              <>
                <h2>A new gathering place.</h2>
                <p>
                  NIP-29 rooms require a compatible relay. Creation is subject
                  to its policy. Messages are public.
                </p>
                <label>
                  Room name
                  <input
                    value={npub}
                    onChange={(e) => setNpub(e.target.value)}
                    placeholder="Your community"
                  />
                </label>
                <label>
                  NIP-29 relay
                  <input
                    value={relayInput}
                    onChange={(e) => setRelayInput(e.target.value)}
                    placeholder="wss://…"
                  />
                </label>
                <button
                  className="primary"
                  onClick={async () => {
                    if (!secret) {
                      show("identity");
                      return;
                    }
                    try {
                      if (
                        new URL(relayInput).protocol !== "wss:" ||
                        !npub.trim()
                      )
                        throw Error();
                      const id = crypto.randomUUID();
                      await accepted(
                        [relayInput],
                        finalizeEvent(
                          {
                            kind: 9007,
                            content: "",
                            tags: [
                              ["h", id],
                              ["name", npub],
                              ["public"],
                              ["open"],
                            ],
                            created_at: Math.floor(Date.now() / 1000),
                          },
                          secret,
                        ),
                      );
                      notice(
                        "Creation request accepted. Discover on this relay to confirm metadata.",
                      );
                      setRelays((rs) => [...new Set([...rs, relayInput])]);
                      setModal("");
                    } catch {
                      setError(
                        "Unable to create room. Check identity, relay policy, and room name.",
                      );
                    }
                  }}
                >
                  Request room creation
                </button>
              </>
            ) : (
              <>
                <h2>
                  Your voice.
                  <br />
                  Your network.
                </h2>
                <p>
                  Unboundwave is an open-source space for human connection.
                  Private messages use Nostr NIP-17 encryption. Public rooms are
                  relay-managed NIP-29 communities.
                </p>
                <p>
                  Relays can see IP addresses, recipient routing and connection
                  timing. Google is an optional account provider. This app does
                  not promise anonymity.
                </p>
                <p>
                  Explore mode contains illustrative conversations. Real
                  messaging requires an unlocked identity and recipient inbox
                  relays.
                </p>
                <button className="primary" onClick={() => show("identity")}>
                  Find your own corner <ArrowUpRight size={17} />
                </button>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
