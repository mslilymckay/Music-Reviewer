import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// =========================================================================
// MODULE 1: APP INITIALIZATION AND DATABASE CLIENT
// =========================================================================

const supabaseUrl = 'https://otidzvnetsbbelmzscea.supabase.co';
const supabaseKey = 'sb_publishable_NXkXV2HuXp1tCbqaz_qDwQ_X942P19x';
const supabase = createClient(supabaseUrl, supabaseKey);

// HTML Escaping Helper
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Toast notification display helper
function showToast(message) {
  let toast = document.getElementById('lnotes-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lnotes-toast-notification';
    toast.className = 'lnotes-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

// =========================================================================
// MODULE 2: USER AUTHENTICATION AND INITIAL LIFE CYCLE
// =========================================================================

window.addEventListener('load', async () => {
  const loadingScreen = document.getElementById('loading-screen');
  const authScreen = document.getElementById('auth-screen');
  
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('[PWA] Service Worker registered:', reg.scope))
      .catch(err => console.error('[PWA] Service Worker registration failed:', err));
  }

  // Session checking
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    loadReviews();
  } else {
    authScreen.classList.remove('hidden');
  }

  // Simple Loading Screen Fade
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.transition = 'opacity 0.8s ease-in-out';
      setTimeout(() => loadingScreen.classList.add('hidden'), 800);
    }, 500);
  }
});

// Authentication Submit Listener
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authErrorText = document.getElementById('auth-error');

if (authSubmitBtn) {
  authSubmitBtn.addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if (authErrorText) authErrorText.style.display = 'none';
    authSubmitBtn.textContent = 'Verifying...';

    const authResponse = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (authResponse.error) {
      if (authErrorText) {
        authErrorText.textContent = "Oops! " + authResponse.error.message;
        authErrorText.style.display = 'block';
      }
      authSubmitBtn.textContent = "Let's go!";
    } else {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
      
      loadReviews();
    }
  });
}

// =========================================================================
// MODULE 3: DATA FETCHING & DASHBOARD RENDER
// =========================================================================

let globalReviewsData = [];

// 1. The Relational Fetch
async function loadReviews() {
  // We use Supabase's foreign key syntax to pull related tables in one go
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      lyric_focus,
      vibe_tags,
      tier,
      created_at,
      tracks (
        id,
        title,
        spotify_url,
        albums (
          title,
          artists ( name )
        )
      )
    `)
    .order('created_at', { ascending: false }); // Newest reviews first

  if (error) {
    console.error("Error fetching reviews:", error);
    showToast("Failed to load your reviews.");
    return;
  }

  globalReviewsData = data;
  renderDashboard(globalReviewsData);
}

// 2. The Render Loop & Spotify Embed Engine
function renderDashboard(reviews) {
  const dashboard = document.getElementById('reviews-dashboard');
  if (!dashboard) return;
  
  dashboard.innerHTML = '';

  if (reviews.length === 0) {
    dashboard.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; opacity: 0.7;">
        <p>Your vault is empty. Time to spin something.</p>
      </div>
    `;
    return;
  }

  reviews.forEach(review => {
    // Digging into the joined relational data
    const track = review.tracks;
    const album = track.albums;
    const artist = album.artists;

    // Spotify iFrame URL Extraction
    // Standard URLs look like: https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=...
    // The embed API requires:  https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT
    let embedUrl = '';
    if (track.spotify_url && track.spotify_url.includes('/track/')) {
      const trackId = track.spotify_url.split('/track/')[1].split('?')[0];
      embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
    } else if (track.spotify_url && track.spotify_url.includes('/album/')) {
      const albumId = track.spotify_url.split('/album/')[1].split('?')[0];
      embedUrl = `https://open.spotify.com/embed/album/${albumId}?utm_source=generator`;
    }

    // Build the DOM element
    const card = document.createElement('div');
    card.className = 'review-card';
    card.style.cssText = 'background: #fff; border-radius: 12px; padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);';

    // Construct the inner HTML securely
    card.innerHTML = `
      <div style="margin-bottom: 12px;">
        <h3 style="margin: 0 0 4px 0; font-size: 1.2rem; color: #1a1a1a;">${escapeHtml(artist.name)}</h3>
        <p style="margin: 0; font-size: 0.9rem; color: #666; font-weight: bold;">${escapeHtml(track.title)}</p>
        ${review.tier ? `<span style="display: inline-block; margin-top: 8px; padding: 4px 8px; background: #eee; border-radius: 4px; font-size: 0.8rem; font-weight: bold;">${escapeHtml(review.tier)}</span>` : ''}
      </div>

      ${embedUrl ? `
        <div style="margin-bottom: 16px;">
          <iframe style="border-radius:12px" src="${embedUrl}" width="100%" height="152" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>
        </div>
      ` : ''}

      ${review.lyric_focus ? `
        <blockquote style="border-left: 3px solid #ccc; margin: 0 0 12px 0; padding-left: 12px; font-style: italic; color: #333;">
          "${escapeHtml(review.lyric_focus)}"
        </blockquote>
      ` : ''}
      
      ${review.vibe_tags ? `
        <p style="margin: 0; font-size: 0.85rem; color: #888; font-family: monospace;">#${escapeHtml(review.vibe_tags)}</p>
      ` : ''}
    `;

    dashboard.appendChild(card);
  });
}

// =========================================================================
// MODULE 4: FORM SUBMISSION & RELATIONAL INSERTS
// =========================================================================

const reviewForm = document.getElementById('new-review-form');
const submitBtn = document.getElementById('submit-review-btn');

if (reviewForm) {
  reviewForm.addEventListener('submit', async (e) => {
    // Prevent the default page reload on form submit
    e.preventDefault();

    // Visual feedback while the database processes the waterfall
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Saving to Vault...';
    submitBtn.disabled = true;

    // 1. Gather Input Data from the DOM
    const artistName = document.getElementById('input-artist').value.trim();
    const albumTitle = document.getElementById('input-album').value.trim();
    const trackTitle = document.getElementById('input-track').value.trim();
    const trackUrl = document.getElementById('input-spotify-url').value.trim();
    const lyricFocus = document.getElementById('input-lyric').value.trim();
    const vibeTags = document.getElementById('input-vibe').value.trim();
    const tier = document.getElementById('input-tier').value;

    try {
      // 2. Resolve Artist ID
      let artistId;
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('name', artistName)
        .single();

      if (existingArtist) {
        artistId = existingArtist.id;
      } else {
        const { data: newArtist, error: artistErr } = await supabase
          .from('artists')
          .insert([{ name: artistName }])
          .select('id')
          .single();
        if (artistErr) throw artistErr;
        artistId = newArtist.id;
      }

      // 3. Resolve Album ID
      let albumId;
      const { data: existingAlbum } = await supabase
        .from('albums')
        .select('id')
        .eq('title', albumTitle)
        .eq('artist_id', artistId)
        .single();

      if (existingAlbum) {
        albumId = existingAlbum.id;
      } else {
        const { data: newAlbum, error: albumErr } = await supabase
          .from('albums')
          .insert([{ 
            artist_id: artistId, 
            title: albumTitle, 
          }])
          .select('id')
          .single();
        if (albumErr) throw albumErr;
        albumId = newAlbum.id;
      }

      // 4. Resolve Track ID
      let trackId;
      const { data: existingTrack } = await supabase
        .from('tracks')
        .select('id')
        .eq('spotify_url', trackUrl)
        .single();

      if (existingTrack) {
        trackId = existingTrack.id;
      } else {
        const { data: newTrack, error: trackErr } = await supabase
          .from('tracks')
          .insert([{ 
            album_id: albumId, 
            title: trackTitle, 
            spotify_url: trackUrl 
          }])
          .select('id')
          .single();
        if (trackErr) throw trackErr;
        trackId = newTrack.id;
      }

      // 5. Insert the Final Review
      const { error: reviewErr } = await supabase
        .from('reviews')
        .insert([{
          track_id: trackId,
          lyric_focus: lyricFocus || null,
          vibe_tags: vibeTags || null,
          tier: tier || null
          // created_at is handled automatically by Postgres defaults
        }]);
      
      if (reviewErr) throw reviewErr;

      // 6. Cleanup and Refresh UI
      reviewForm.reset();
      showToast("Review logged successfully!");
      
      // Call the function from Module 3 to pull the fresh data
      loadReviews(); 

    } catch (error) {
      console.error("Submission Error:", error);
      showToast("Failed to save review. Check console.");
    } finally {
      // Restore button state
      submitBtn.textContent = originalBtnText;
      submitBtn.disabled = false;
    }
  });
}