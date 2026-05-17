import { useEffect, useState, useRef, useCallback } from 'react';
import { eventsAPI } from '../utils/api';
import Cropper from 'react-easy-crop';

function Events({ theme }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await eventsAPI.listPublic(50);
        setEvents(res.events || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fileInputRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    if (selected) {
      const prev = document.body.style.overflow;
      document.body.dataset.prevOverflow = prev;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = document.body.dataset.prevOverflow || '';
        delete document.body.dataset.prevOverflow;
      };
    }
  }, [selected]);

  const onFileChange = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCropSrc({ url, file: f });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (imageSrc, pixelCrop) => {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', reject);
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        const blobUrl = URL.createObjectURL(blob);
        resolve({ blob, blobUrl });
      }, 'image/jpeg', 0.95);
    });
  };

  const saveCropped = async () => {
    if (!croppedAreaPixels || !cropSrc) return;
    const result = await createCroppedImage(cropSrc.url, croppedAreaPixels);
    if (!result) return;
    const { blobUrl } = result;
    const updated = { ...selected, thumbnailUrl: blobUrl };
    setSelected(updated);
    setEvents((prev) => prev.map(ev => ev._id === updated._id ? updated : ev));
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const EventModal = ({ event }) => {
    if (!event) return null;
    const dt = new Date(event.startTime);
    const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const isRemote = event.isRemote === true || event.isRemote === 'true';
    return (
      <div className="hub-modal-overlay" onClick={() => { setSelected(null); setCropSrc(null); }}>
        <div className="hub-modal" onClick={e => e.stopPropagation()}>
          <div className="hub-modal-header">{event.title}</div>
          <div className="hub-modal-content">
            {(event.thumbnailUrl || cropSrc) && (
              <div style={{ marginBottom: 12 }}>
                <img src={cropSrc ? cropSrc.url : event.thumbnailUrl} alt={event.title} className="hub-modal-image" style={{ maxWidth: '100%', maxHeight: 300, display: 'block' }} />
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="hub-btn">
                Replace / Adjust Image
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </div>

            {cropSrc && (
              <div style={{ marginTop: 12 }}>
                <div style={{ position: 'relative', width: '100%', height: 400, background: '#000' }}>
                  <Cropper
                    image={cropSrc.url}
                    crop={crop}
                    zoom={zoom}
                    aspect={16 / 9}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                  />
                </div>
                <div style={{ marginTop: 12, marginBottom: 12 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
                    Zoom: {zoom.toFixed(1)}x
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveCropped} className="hub-btn">Crop & Save</button>
                  <button onClick={() => { setCropSrc(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="hub-btn ghost">Cancel</button>
                </div>
              </div>
            )}

            <div className="hub-event-details">
            <div className="hub-detail-section">
              <div className="hub-detail-item">
                <span className="hub-detail-label">📅 Date & Time</span>
                <strong className="hub-detail-value">{formatted}</strong>
              </div>
              
              <div className="hub-detail-item">
                <span className="hub-detail-label">📍 Location</span>
                {isRemote ? (
                  <div className="hub-detail-value">
                    <strong>Remote Event</strong>
                    {event.zoomLink ? (
                      <div className="hub-zoom-link">
                        <a href={event.zoomLink} target="_blank" rel="noreferrer" className="hub-btn link">
                          🔗 Join Webinar
                        </a>
                      </div>
                    ) : (
                      <div className="hub-address">Zoom link will be provided</div>
                    )}
                  </div>
                ) : (
                  <div className="hub-detail-value">
                    {event.locationName ? (
                      <div><strong>{event.locationName}</strong></div>
                    ) : (
                      <div><strong>In-Person Event</strong></div>
                    )}
                    {event.address ? (
                      <div className="hub-address">{event.address}</div>
                    ) : (
                      <div className="hub-address">Location details will be provided</div>
                    )}
                    {event.directions && <div className="hub-directions">{event.directions}</div>}
                  </div>
                )}
              </div>

              {event.description && (
                <div className="hub-detail-item">
                  <span className="hub-detail-label">📝 Description</span>
                  <div className="hub-detail-value hub-description">{event.description}</div>
                </div>
              )}

              <div className="hub-detail-item">
                <span className="hub-detail-label">ℹ️ Event Info</span>
                <div className="hub-detail-value">
                  <div className="hub-event-meta">
                    <span className="hub-meta-item">
                      <strong>Event Type:</strong> {isRemote ? 'Remote' : 'In-Person'}
                    </span>
                    <span className="hub-meta-item">
                      <strong>Status:</strong> {event.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <span className="hub-meta-item">
                      <strong>Created:</strong> {new Date(event.createdAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
            {event.meetupUrl && (
              <div className="hub-action-buttons">
                <div className="hub-meetup-section">
                  <a href={event.meetupUrl} target="_blank" rel="noreferrer" className="hub-meetup-btn" title="Reserve your spot on Meetup">
                    <img src="/meetup.svg" alt="Meetup" />
                  </a>
                  <span className="hub-meetup-label">Reserve your spot</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="landing-container">
      <section className="events-section">
        <div className="section-header">
          <h2>All Events</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">📅</div>
            <span></span>
          </div>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>Loading events...</div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>No upcoming events.</div>
        ) : (
          <div className="events-grid" data-count={events.length}>
            {events.map(ev => {
              const dt = new Date(ev.startTime);
              const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              return (
                <div key={ev._id} className="event-card" onClick={() => setSelected(ev)}>
                  {ev.thumbnailUrl && (
                    <img src={ev.thumbnailUrl} alt={ev.title} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{formatted}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {selected && <EventModal event={selected} />}
    </div>
  );
}

export default Events;


