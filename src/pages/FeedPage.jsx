import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { getPaginatedPosts, deletePost, toggleLike, checkLiked, subscribeFriends } from '../firebase/firestore';

function PostAvatar({ photoURL, displayName, gender, size = 40 }) {
  const COLORS = { male: 'var(--color-male)', female: 'var(--color-female)', other: 'var(--color-other)' };
  const bg = COLORS[gender] || 'var(--color-primary)';
  if (photoURL) {
    return <img src={photoURL} alt="" loading="lazy" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.38, flexShrink: 0 }}>
      {(displayName || '?')[0].toUpperCase()}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ height: 12, width: 120, borderRadius: 6 }} />
          <div className="skeleton" style={{ height: 10, width: 80, borderRadius: 6 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: '100%', height: 200 }} />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ height: 10, width: '80%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 6 }} />
      </div>
    </div>
  );
}

function PostCard({ post, currentUid, onDelete }) {
  const showToast = useToast();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes || 0);
  const [showMenu, setShowMenu] = useState(false);
  const isOwn = post.uid === currentUid;
  const ts = post.createdAt?.toDate?.() || new Date();

  useEffect(() => {
    checkLiked(post.id, currentUid).then(setLiked).catch(() => {});
  }, [post.id, currentUid]);

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? c - 1 : c + 1);
    try {
      await toggleLike(post.id, currentUid, wasLiked);
    } catch {
      setLiked(wasLiked);
      setLikeCount((c) => wasLiked ? c + 1 : c - 1);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(`${window.location.origin}/feed`).then(() => {
      showToast('Link copied to clipboard', 'success');
    });
  };

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 16, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px' }}>
        <PostAvatar photoURL={post.photoURL} displayName={post.displayName} gender={post.gender} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{post.displayName || 'User'}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {post.username ? `@${post.username} · ` : ''}{formatDistanceToNow(ts, { addSuffix: true })}
          </div>
        </div>
        {isOwn && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowMenu((s) => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4 }}>
              <i className="ti ti-dots-vertical" style={{ fontSize: 20 }} />
            </button>
            {showMenu && (
              <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '4px 0', zIndex: 50, minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                <button onClick={() => { setShowMenu(false); onDelete(post.id); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 14 }}>
                  <i className="ti ti-trash" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.type === 'photo' && post.imageURL && (
        <img src={post.imageURL} alt="" loading="lazy" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} onError={(e) => { e.target.style.display = 'none'; }} />
      )}
      {post.content && (
        <div style={{ padding: post.type === 'text' ? 0 : '0 16px' }}>
          {post.type === 'text' ? (
            <div style={{ background: 'var(--color-surface-2)', padding: 16, fontSize: 16, lineHeight: 1.6 }}>{post.content}</div>
          ) : (
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', padding: '10px 0 4px' }}>{post.content}</p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '10px 16px 14px' }}>
        <button onClick={handleLike} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: liked ? 'var(--color-danger)' : 'var(--color-text-secondary)', fontSize: 14, padding: 0 }}>
          <i className={`ti ${liked ? 'ti-heart-filled' : 'ti-heart'}`} style={{ fontSize: 20 }} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, padding: 0 }}>
          <i className="ti ti-message" style={{ fontSize: 20 }} />
          {post.commentsCount > 0 && <span>{post.commentsCount}</span>}
        </button>
        <button onClick={handleShare} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 14, padding: 0 }}>
          <i className="ti ti-send" style={{ fontSize: 20 }} />
        </button>
      </div>
    </div>
  );
}

export default function FeedPage({ user, profile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [friendsSet, setFriendsSet] = useState(new Set());
  const lastDocRef = useRef(null);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriends(user.uid, (friends) => {
      setFriendsSet(new Set(friends.map((f) => f.uid)));
    });
  }, [user?.uid]);

  const loadPosts = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    try {
      const { posts: newPosts, lastDoc, hasMore: more } = await getPaginatedPosts(
        isLoadMore ? lastDocRef.current : null
      );
      lastDocRef.current = lastDoc;
      setHasMore(more);
      setPosts((prev) => isLoadMore ? [...prev, ...newPosts] : newPosts);
    } catch {
      showToast('Failed to load posts', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [showToast]);

  useEffect(() => { loadPosts(false); }, []);

  const handleDelete = async (postId) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast('Post deleted', 'success');
    } catch { showToast('Failed to delete post', 'error'); }
  };

  const visiblePosts = posts.filter((post) => !post.isPrivate || post.uid === user?.uid || friendsSet.has(post.uid));

  return (
    <div className="page" style={{ position: 'relative' }}>
      <div className="page-header">
        <Logo variant="icon" size={32} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <i className="ti ti-bell" style={{ fontSize: 22, color: 'var(--color-text-secondary)', cursor: 'pointer' }} />
          <ThemeToggle />
        </div>
      </div>

      <div style={{ padding: '16px 16px 80px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map((n) => <PostSkeleton key={n} />)}
          </div>
        ) : visiblePosts.length === 0 ? (
          <EmptyState
            icon="ti-photo"
            title="Nothing here yet"
            subtitle={"Be the first to share a quick\nor follow more people"}
            actionLabel="Post a Quick"
            onAction={() => navigate('/create-post')}
          />
        ) : (
          <>
            {visiblePosts.map((post) => (
              <PostCard key={post.id} post={post} currentUid={user?.uid} onDelete={handleDelete} />
            ))}
            {hasMore && (
              <button
                onClick={() => loadPosts(true)}
                disabled={loadingMore}
                style={{ width: '100%', padding: '14px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 12, fontWeight: 600, fontSize: 14, color: 'var(--color-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loadingMore ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Load more'}
              </button>
            )}
          </>
        )}
      </div>

      <button
        onClick={() => navigate('/create-post')}
        style={{
          position: 'fixed',
          bottom: 80,
          right: 'calc(50% - 215px + 16px)',
          width: 56, height: 56,
          borderRadius: '50%',
          background: 'var(--color-primary)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          boxShadow: '0 4px 20px rgba(108,99,255,0.4)',
          zIndex: 50,
        }}
      >
        <i className="ti ti-plus" style={{ fontSize: 26 }} />
      </button>
    </div>
  );
}
