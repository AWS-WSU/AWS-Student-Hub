import { useState, useEffect, useRef, useCallback } from 'react';
import './styles/Landing.css';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SocialLinks from '../components/SocialLinks';
import { authAPI, eventsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Cropper from 'react-easy-crop';

const getEasternDateTime = (utcDate) => {
  const date = new Date(utcDate);
  const eastern = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  
  const parts = {};
  eastern.forEach(p => { parts[p.type] = p.value; });
  
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`
  };
};

const easternToISO = (dateStr, timeStr) => {
  const testDate = new Date(`${dateStr}T12:00:00`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    timeZoneName: 'shortOffset'
  });
  const parts = formatter.formatToParts(testDate);
  const offsetPart = parts.find(p => p.type === 'timeZoneName');
  // offsetPart.value will be like "GMT-5" or "GMT-4"
  const offsetMatch = offsetPart?.value?.match(/GMT([+-]?\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
  // Format as -05:00 or -04:00
  const sign = offsetHours >= 0 ? '+' : '-';
  const absHours = Math.abs(offsetHours).toString().padStart(2, '0');
  const offsetStr = `${sign}${absHours}:00`;
  
  return new Date(`${dateStr}T${timeStr}:00${offsetStr}`).toISOString();
};

function Landing({ theme, toggleTheme }) {
  const [activeSection, setActiveSection] = useState('home');
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [showReferralLink, setShowReferralLink] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const sectionsRef = useRef({});
  const navigate = useNavigate();
  const { user } = useAuth();
  
  useEffect(() => {
    if (user) {
      console.log('Landing page user data:', {
        username: user.username,
        hasAccessKey: !!user.awsAccessKeyId,
        hasSecretKey: !!user.awsSecretAccessKey,
        hasViewed: user.hasViewedAwsCredentials
      });
    }
  }, [user]);
  
  useEffect(() => {
    const observers = [];
    const sections = ['home', 'about', 'events', 'resources'];
    
    sections.forEach(section => {
      if (sectionsRef.current[section]) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActiveSection(section);
            }
          },
          { threshold: 0.3 }
        );
        
        observer.observe(sectionsRef.current[section]);
        observers.push(observer);
      }
    });
    
    return () => {
      observers.forEach(observer => observer.disconnect());
    };
  }, []);

  useEffect(() => {
    const lock = showCreateModal || !!selectedEvent;
    if (lock) {
      const prev = document.body.style.overflow;
      document.body.dataset.prevOverflow = prev;
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = document.body.dataset.prevOverflow || '';
      delete document.body.dataset.prevOverflow;
    }
    return () => {
      document.body.style.overflow = document.body.dataset.prevOverflow || '';
      delete document.body.dataset.prevOverflow;
    };
  }, [showCreateModal, selectedEvent]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await eventsAPI.listPublic(6);
        setEvents(res.events || []);
      } catch {
        setEvents([]);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    const fetchRecentUsers = async () => {
      try {
        const response = await authAPI.getRecentUsers(6);
        setRecentUsers(response.users || []);
      } catch (error) {
        console.error('Error fetching recent users:', error);
        setRecentUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchRecentUsers();
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      return;
    }

    setIsSearching(true);
    setSearchPerformed(true);
    setShowReferralLink(false);
    
    try {
      const response = await authAPI.searchUsers(searchQuery.trim(), 5);
      setSearchResults(response.users || []);
      
      if (!response.users || response.users.length === 0) {
        setTimeout(() => setShowReferralLink(true), 500);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
      setTimeout(() => setShowReferralLink(true), 500);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (!value.trim()) {
      setSearchResults([]);
      setSearchPerformed(false);
      setShowReferralLink(false);
      setReferralCopied(false);
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const generateReferralLink = () => {
    const currentUrl = window.location.origin;
    return `${currentUrl}/auth?mode=signup&ref=${user?.username || 'friend'}`;
  };

  const copyReferralLink = async () => {
    try {
      const referralLink = generateReferralLink();
      await navigator.clipboard.writeText(referralLink);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy referral link:', error);
    }
  };



  const scrollToSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleJoinClick = () => {
    navigate('/auth?mode=signup');
  };
  const isAdmin = user && (user.role === 'admin' || user.role === 'superuser');
  const handleCreateEventClick = () => setShowCreateModal(true);
  const closeCreateModal = () => setShowCreateModal(false);
  const closeEventModal = () => setSelectedEvent(null);

  const CreateEventModal = () => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [isRemote, setIsRemote] = useState(true);
    const [zoomLink, setZoomLink] = useState('');
    const [address, setAddress] = useState('');
    const [directions, setDirections] = useState('');
    const [locationName, setLocationName] = useState('');
    const [meetupUrl, setMeetupUrl] = useState('');
    const [thumbnail] = useState(null);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});
    const [sendEmailNotification, setSendEmailNotification] = useState(false);
    const [emailCustomMessage, setEmailCustomMessage] = useState('');
    const [emailStatus, setEmailStatus] = useState(null);
    
    const [cropSrc, setCropSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [croppedBlob, setCroppedBlob] = useState(null);
    const fileInputRef = useRef(null);

    const onFileChange = (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      setCropSrc({ url, file: f });
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedBlob(null);
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
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    };

    const saveCropped = async () => {
      if (!croppedAreaPixels || !cropSrc) return;
      const blob = await createCroppedImage(cropSrc.url, croppedAreaPixels);
      if (!blob) return;
      setCroppedBlob(blob);
      setCropSrc(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const validateForm = () => {
      const newErrors = {};
      if (!title.trim()) newErrors.title = 'Title is required';
      if (!date) newErrors.date = 'Date is required';
      if (!time) newErrors.time = 'Time is required';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const submit = async () => {
      if (!validateForm()) return;
      
      setSubmitting(true);
      setEmailStatus(null);
      try {
        const startTime = easternToISO(date, time);
        const payload = {
          title,
          startTime,
          isRemote: String(isRemote),
          meetupUrl
        };
        if (description) payload.description = description;
        if (croppedBlob) payload.thumbnail = croppedBlob;
        else if (thumbnail) payload.thumbnail = thumbnail;
        
        if (isRemote) {
          payload.zoomLink = zoomLink;
        } else {
          payload.address = address;
          payload.directions = directions;
          payload.locationName = locationName;
        }
        const res = await eventsAPI.create(payload);
        setEvents(prev => [res.event, ...prev].slice(0, 6));

        if (sendEmailNotification && res.event?._id) {
          setEmailStatus('sending');
          try {
            const emailRes = await eventsAPI.sendNotification(res.event._id, emailCustomMessage);
            setEmailStatus({ 
              success: true, 
              sent: emailRes.emailsSent, 
              failed: emailRes.emailsFailed 
            });
            setTimeout(() => setShowCreateModal(false), 2000);
          } catch (emailError) {
            console.error('Error sending email notifications:', emailError);
            setEmailStatus({ success: false, error: emailError.message });
            setTimeout(() => setShowCreateModal(false), 3000);
          }
        } else {
          setShowCreateModal(false);
        }
      } catch (error) {
        console.error('Error creating event:', error);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="hub-modal-overlay" onClick={closeCreateModal}>
        <div className="hub-modal" onClick={e => e.stopPropagation()}>
          <div className="hub-modal-header">Create Event</div>
          <div className="hub-modal-content">
          <div className="hub-form-row">
            <label>Title *</label>
            <input 
              value={title} 
              onChange={e => {
                setTitle(e.target.value);
                if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
              }} 
              placeholder="Event title" 
              className={errors.title ? 'input-error' : ''}
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
          </div>
          <div className="hub-form-row hub-row-2">
            <div style={{ flex: 1 }}>
              <label>Date *</label>
              <input 
                type="date" 
                value={date} 
                onChange={e => {
                  setDate(e.target.value);
                  if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                }} 
                className={errors.date ? 'input-error' : ''}
              />
              {errors.date && <span className="error-message">{errors.date}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <label>Time *</label>
              <input 
                type="time" 
                value={time} 
                onChange={e => {
                  setTime(e.target.value);
                  if (errors.time) setErrors(prev => ({ ...prev, time: '' }));
                }} 
                className={errors.time ? 'input-error' : ''}
              />
              {errors.time && <span className="error-message">{errors.time}</span>}
            </div>
          </div>
          <div className="hub-form-row">
            <label>Location</label>
            <div className={`hub-toggle ${isRemote ? 'remote-selected' : 'inperson-selected'}`}>
              <button className={`hub-toggle-btn ${isRemote ? 'active' : ''}`} onClick={() => setIsRemote(true)}>Remote</button>
              <button className={`hub-toggle-btn ${!isRemote ? 'active' : ''}`} onClick={() => setIsRemote(false)}>In Person</button>
            </div>
          </div>
          {isRemote ? (
            <div className="hub-form-row">
              <label>Zoom/Webinar Link</label>
              <input value={zoomLink} onChange={e => setZoomLink(e.target.value)} placeholder="https://..." />
            </div>
          ) : (
            <>
              <div className="hub-form-row">
                <label>Location Name</label>
                <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Building/Room" />
              </div>
              <div className="hub-form-row">
                <label>Address</label>
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, City, State" />
              </div>
              <div className="hub-form-row">
                <label>Directions (max 250)</label>
                <textarea value={directions} onChange={e => setDirections(e.target.value.slice(0,250))} rows={3} />
              </div>
            </>
          )}
          <div className="hub-form-row">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Tell people what to expect" />
          </div>
          <div className="hub-form-row">
            <label>Meetup Link</label>
            <input value={meetupUrl} onChange={e => setMeetupUrl(e.target.value)} placeholder="https://www.meetup.com/..." />
          </div>
          <div className="hub-form-row">
            <label>Email Notification</label>
            <div 
              className="email-toggle-container"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: sendEmailNotification ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-secondary)',
                borderRadius: '10px',
                border: sendEmailNotification ? '2px solid #22c55e' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setSendEmailNotification(!sendEmailNotification)}
            >
              <div 
                style={{
                  width: '48px',
                  height: '26px',
                  borderRadius: '13px',
                  background: sendEmailNotification ? '#22c55e' : 'var(--text-tertiary)',
                  position: 'relative',
                  transition: 'background 0.2s ease'
                }}
              >
                <div 
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '2px',
                    left: sendEmailNotification ? '24px' : '2px',
                    transition: 'left 0.2s ease',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  {sendEmailNotification ? '📧 Email notifications enabled' : '📧 Send email to all members'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {sendEmailNotification 
                    ? 'All registered members will receive an email about this event' 
                    : 'Toggle to notify all registered members about this event'}
                </div>
              </div>
            </div>
            {sendEmailNotification && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '0.9rem', 
                  fontWeight: 500,
                  color: 'var(--text-primary)' 
                }}>
                  Custom Message (optional)
                </label>
                <textarea
                  value={emailCustomMessage}
                  onChange={(e) => setEmailCustomMessage(e.target.value)}
                  placeholder="Add a personal message to include in the email notification..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  This message will appear at the top of the email, before the event details.
                </div>
              </div>
            )}
            {emailStatus === 'sending' && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: 'rgba(59, 130, 246, 0.1)', 
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#3b82f6'
              }}>
                <div className="loading-dots" style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                  <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                  <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
                </div>
                Sending email notifications...
              </div>
            )}
            {emailStatus && emailStatus.success && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                borderRadius: '8px',
                color: '#22c55e',
                fontWeight: 500
              }}>
                Successfully sent {emailStatus.sent} emails! 
                {emailStatus.failed > 0 && ` (${emailStatus.failed} failed)`}
              </div>
            )}
            {emailStatus && emailStatus.success === false && (
              <div style={{ 
                marginTop: '12px', 
                padding: '12px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                borderRadius: '8px',
                color: '#ef4444',
                fontWeight: 500
              }}>
                Failed to send emails: {emailStatus.error}
              </div>
            )}
          </div>
          <div className="hub-form-row">
            <label>Thumbnail</label>
            {croppedBlob && (
              <div style={{ marginBottom: 12 }}>
                <img 
                  src={URL.createObjectURL(croppedBlob)} 
                  alt="Cropped preview" 
                  style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', borderRadius: 8 }} 
                />
                <button 
                  type="button"
                  onClick={() => {
                    setCroppedBlob(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }} 
                  className="hub-btn ghost"
                  style={{ marginTop: 8 }}
                >
                  Remove Image
                </button>
              </div>
            )}
            {!croppedBlob && !cropSrc && (
              <div className="hub-file-upload" onClick={() => fileInputRef.current?.click()}>
                <input 
                  ref={fileInputRef}
                  id="thumbnail-upload"
                  type="file" 
                  accept="image/*" 
                  onChange={onFileChange}
                  style={{ display: 'none' }}
                />
                <div className="hub-file-upload-icon">📁</div>
                <div className="hub-file-info">Click to select an image</div>
              </div>
            )}
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
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, color: 'var(--text-primary)' }}>
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
                  <button type="button" onClick={saveCropped} className="hub-btn">Crop & Save</button>
                  <button type="button" onClick={() => { 
                    setCropSrc(null); 
                    if (fileInputRef.current) fileInputRef.current.value = ''; 
                  }} className="hub-btn ghost">Cancel</button>
                </div>
              </div>
            )}
          </div>
            <div className="hub-modal-actions">
              <button className="hub-btn ghost" onClick={closeCreateModal} disabled={submitting}>Cancel</button>
              <button className="hub-btn primary" onClick={submit} disabled={submitting}>{submitting ? 'Creating...' : 'Create'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EventModal = ({ event }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const easternDT = getEasternDateTime(event.startTime);
    const [editForm, setEditForm] = useState({
      title: event.title,
      date: easternDT.date,
      time: easternDT.time,
      isRemote: event.isRemote === true || event.isRemote === 'true',
      zoomLink: event.zoomLink || '',
      address: event.address || '',
      directions: event.directions || '',
      locationName: event.locationName || '',
      meetupUrl: event.meetupUrl || '',
      description: event.description || '',
    });
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errors, setErrors] = useState({});

    if (!event) return null;

    const validateEditForm = () => {
      const newErrors = {};
      if (!editForm.title.trim()) newErrors.title = 'Title is required';
      if (!editForm.date) newErrors.date = 'Date is required';
      if (!editForm.time) newErrors.time = 'Time is required';
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    const handleUpdate = async () => {
      if (!validateEditForm()) return;
      
      setUpdating(true);
      try {
        const startTime = easternToISO(editForm.date, editForm.time);
        const payload = {
          title: editForm.title,
          startTime,
          isRemote: String(editForm.isRemote),
          meetupUrl: editForm.meetupUrl,
          description: editForm.description,
        };
        
        if (editForm.isRemote) {
          payload.zoomLink = editForm.zoomLink;
        } else {
          payload.address = editForm.address;
          payload.directions = editForm.directions;
          payload.locationName = editForm.locationName;
        }

        const res = await eventsAPI.update(event._id, payload);
        setEvents(prev => prev.map(ev => ev._id === event._id ? res.event : ev));
        setSelectedEvent(res.event);
        setIsEditing(false);
      } catch (error) {
        console.error('Error updating event:', error);
      } finally {
        setUpdating(false);
      }
    };

    const handleDelete = async () => {
      setDeleting(true);
      try {
        await eventsAPI.delete(event._id);
        setEvents(prev => prev.filter(ev => ev._id !== event._id));
        setSelectedEvent(null);
      } catch (error) {
        console.error('Error deleting event:', error);
      } finally {
        setDeleting(false);
      }
    };

    const dt = new Date(event.startTime);
    const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const isRemote = event.isRemote === true || event.isRemote === 'true';

    if (showDeleteConfirm) {
      return (
        <div className="hub-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="hub-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="hub-modal-header">Delete Event?</div>
            <div className="hub-modal-content">
              <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete "<strong>{event.title}</strong>"? This action cannot be undone.
              </p>
              <div className="hub-modal-actions">
                <button className="hub-btn ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  Cancel
                </button>
                <button 
                  className="hub-btn" 
                  onClick={handleDelete} 
                  disabled={deleting}
                  style={{ background: '#dc2626', color: 'white' }}
                >
                  {deleting ? 'Deleting...' : 'Delete Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isEditing) {
      return (
        <div className="hub-modal-overlay" onClick={() => setIsEditing(false)}>
          <div className="hub-modal" onClick={e => e.stopPropagation()}>
            <div className="hub-modal-header">Edit Event</div>
            <div className="hub-modal-content">
              <div className="hub-form-row">
                <label>Title *</label>
                <input 
                  value={editForm.title} 
                  onChange={e => {
                    setEditForm(prev => ({ ...prev, title: e.target.value }));
                    if (errors.title) setErrors(prev => ({ ...prev, title: '' }));
                  }}
                  placeholder="Event title"
                  className={errors.title ? 'input-error' : ''}
                />
                {errors.title && <span className="error-message">{errors.title}</span>}
              </div>
              <div className="hub-form-row hub-row-2">
                <div style={{ flex: 1 }}>
                  <label>Date *</label>
                  <input 
                    type="date" 
                    value={editForm.date}
                    onChange={e => {
                      setEditForm(prev => ({ ...prev, date: e.target.value }));
                      if (errors.date) setErrors(prev => ({ ...prev, date: '' }));
                    }}
                    className={errors.date ? 'input-error' : ''}
                  />
                  {errors.date && <span className="error-message">{errors.date}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <label>Time *</label>
                  <input 
                    type="time" 
                    value={editForm.time}
                    onChange={e => {
                      setEditForm(prev => ({ ...prev, time: e.target.value }));
                      if (errors.time) setErrors(prev => ({ ...prev, time: '' }));
                    }}
                    className={errors.time ? 'input-error' : ''}
                  />
                  {errors.time && <span className="error-message">{errors.time}</span>}
                </div>
              </div>
              <div className="hub-form-row">
                <label>Location</label>
                <div className={`hub-toggle ${editForm.isRemote ? 'remote-selected' : 'inperson-selected'}`}>
                  <button className={`hub-toggle-btn ${editForm.isRemote ? 'active' : ''}`} onClick={() => setEditForm(prev => ({ ...prev, isRemote: true }))}>Remote</button>
                  <button className={`hub-toggle-btn ${!editForm.isRemote ? 'active' : ''}`} onClick={() => setEditForm(prev => ({ ...prev, isRemote: false }))}>In Person</button>
                </div>
              </div>
              {editForm.isRemote ? (
                <div className="hub-form-row">
                  <label>Zoom/Webinar Link</label>
                  <input value={editForm.zoomLink} onChange={e => setEditForm(prev => ({ ...prev, zoomLink: e.target.value }))} placeholder="https://..." />
                </div>
              ) : (
                <>
                  <div className="hub-form-row">
                    <label>Location Name</label>
                    <input value={editForm.locationName} onChange={e => setEditForm(prev => ({ ...prev, locationName: e.target.value }))} placeholder="Building/Room" />
                  </div>
                  <div className="hub-form-row">
                    <label>Address</label>
                    <input value={editForm.address} onChange={e => setEditForm(prev => ({ ...prev, address: e.target.value }))} placeholder="Street, City, State" />
                  </div>
                  <div className="hub-form-row">
                    <label>Directions (max 250)</label>
                    <textarea value={editForm.directions} onChange={e => setEditForm(prev => ({ ...prev, directions: e.target.value.slice(0,250) }))} rows={3} />
                  </div>
                </>
              )}
              <div className="hub-form-row">
                <label>Description</label>
                <textarea value={editForm.description} onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))} rows={4} placeholder="Tell people what to expect" />
              </div>
              <div className="hub-form-row">
                <label>Meetup Link</label>
                <input value={editForm.meetupUrl} onChange={e => setEditForm(prev => ({ ...prev, meetupUrl: e.target.value }))} placeholder="https://www.meetup.com/..." />
              </div>
              <div className="hub-modal-actions">
                <button className="hub-btn ghost" onClick={() => setIsEditing(false)} disabled={updating}>Cancel</button>
                <button className="hub-btn primary" onClick={handleUpdate} disabled={updating}>{updating ? 'Updating...' : 'Update Event'}</button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="hub-modal-overlay" onClick={closeEventModal}>
        <div className="hub-modal" onClick={e => e.stopPropagation()}>
          <div className="hub-modal-header">
            {event.title}
            {isAdmin && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button 
                  className="hub-btn ghost" 
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="hub-btn ghost" 
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderColor: '#dc2626', color: '#dc2626' }}
                >
                  🗑️ Delete
                </button>
              </div>
            )}
          </div>
          <div className="hub-modal-content">
            {event.thumbnailUrl && (
              <img src={event.thumbnailUrl} alt={event.title} className="hub-modal-image" />
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

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
  };

  return (
    <div className="landing-container">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeSection={activeSection} 
        scrollToSection={scrollToSection} 
        themeIcon={theme === 'light' ? "/dark.svg" : "/light.svg"}
      />
      
      <section id="home" className="hero-section" ref={el => sectionsRef.current.home = el}>
        <div className="hero-backdrop"></div>
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div 
            className="hero-logo-container"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <img 
              src={theme === 'light' ? "/aws-logo-dark.svg" : "/aws-logo-light.svg"} 
              alt="AWS Logo" 
              className="hero-logo" 
            />
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="hero-title"
          >
            <span className="hero-main-text">
              <span className="gradient-text animated-text">
                Building The Future
              </span>
            </span>
            <span className="hero-subtitle">
              with Cloud Computing
            </span>
          </motion.h2>
          
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
          >
            Join a community of cloud enthusiasts learning, building, and innovating together
          </motion.p>
          
          <motion.div 
            className="cta-buttons"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8 }}
          >
            <button className="cta-primary pulse-animation" onClick={handleJoinClick}>
              Join the Club
            </button>
            <button className="cta-secondary" onClick={() => scrollToSection('about')}>
              Learn More
            </button>
          </motion.div>
          
          <motion.div 
            className="scroll-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.8 }}
            onClick={() => scrollToSection('about')}
          >
            <span>Explore</span>
            <div className="scroll-arrow"></div>
          </motion.div>
        </motion.div>
        
        <div className="floating-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>
      </section>

      <section id="welcome" className="welcome-section">
        <div className="section-header">
          <h2>Welcome Our Newest Members!</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">👋</div>
            <span></span>
          </div>
        </div>
        
        {loadingUsers ? (
          <motion.div 
            className="loading-users"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="loading-text">
              <span>Loading our newest members...</span>
              <div className="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </motion.div>
        ) : recentUsers.length > 0 ? (
          <motion.div 
            className="welcome-users-container"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="welcome-users-grid">
              {Array.from({ length: 3 }).map((_, index) => {
                const user = recentUsers[index];
                const isPlaceholder = !user;
                
                return (
                  <motion.div
                    key={user?._id || `placeholder-${index}`}
                    className={`welcome-user-card ${isPlaceholder ? 'placeholder-card' : ''}`}
                    initial={{ opacity: 0, y: 50 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    viewport={{ once: true, amount: 0.3 }}
                    onClick={!isPlaceholder ? () => handleUserClick(user.username) : undefined}
                    whileHover={!isPlaceholder ? { scale: 1.02 } : {}}
                    whileTap={!isPlaceholder ? { scale: 0.98 } : {}}
                  >
                    {!isPlaceholder ? (
                      <>
                                                 <div className="user-avatar">
                           <img 
                             src={user.profilePicture || '/avatar.jpg'} 
                             alt={`${user.fullName}'s profile`}
                             onError={(e) => {
                               e.target.src = '/avatar.jpg';
                             }}
                           />
                         </div>
                        <div className="user-info">
                          <h4 className="user-name">{user.fullName}</h4>
                          <p className="user-username">@{user.username}</p>
                          <span className="join-date">
                            Joined {new Date(user.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>
                                                 <div className="welcome-badge">
                           New
                         </div>
                      </>
                    ) : (
                      <>
                        <div className="placeholder-avatar">
                          <div className="placeholder-icon">👋</div>
                        </div>
                        <div className="placeholder-info">
                          <h4 className="placeholder-title">Your Spot Awaits</h4>
                          <p className="placeholder-text">Join our community</p>
                          <span className="placeholder-cta">Be the next member!</span>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </div>
            <motion.p 
              className="welcome-message"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true, amount: 0.3 }}
            >
              Let's give a warm welcome to our newest club members! 🎉 
              Ready to join this amazing community?
            </motion.p>
          </motion.div>
        ) : (
          <motion.div 
            className="no-users-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="no-users-icon">🌟</div>
            <h3>Be Our First Member!</h3>
            <p>Join our community and be part of something amazing from the beginning.</p>
          </motion.div>
        )}
      </section>

      {user && (
        <section id="friend-search" className="friend-search-section">
          <div className="section-header">
            <h2>Find a Friend</h2>
            <div className="section-divider">
              <span></span>
              <div className="divider-icon">🔍</div>
              <span></span>
            </div>
          </div>
          <div className="friend-search-content">
            <motion.div 
              className="search-input-container"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true, amount: 0.3 }}
            >
                             <input
                 type="text"
                 placeholder="Search by name, username, or email..."
                 value={searchQuery}
                 onChange={handleSearchInputChange}
                 onKeyPress={handleSearchKeyPress}
                 className="search-input"
               />
              <button className="search-button" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </motion.div>

            {searchPerformed && searchResults.length === 0 && (
              <motion.div 
                className="no-results-message"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <div className="no-results-icon">🔍</div>
                <h3>No results found for "{searchQuery}"</h3>
                <p>Try a different search term or invite a friend directly.</p>
                {showReferralLink && (
                  <motion.div 
                    className="referral-link-container"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true, amount: 0.3 }}
                  >
                                         <p>Don't see your friend? <span className="referral-link" onClick={copyReferralLink}>Copy invite link</span></p>
                    {referralCopied && (
                      <span className="copied-message">Copied!</span>
                    )}
                  </motion.div>
                )}
              </motion.div>
            )}

            {searchPerformed && searchResults.length > 0 && (
              <motion.div 
                className="search-results-container"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true, amount: 0.3 }}
              >
                <h3>Search Results</h3>
                <div className="search-results-grid">
                  {searchResults.map(result => (
                    <motion.div
                      key={result._id}
                      className="search-result-card"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: searchResults.indexOf(result) * 0.1 }}
                      viewport={{ once: true, amount: 0.3 }}
                      onClick={() => handleUserClick(result.username)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="user-avatar">
                        <img 
                          src={result.profilePicture || '/avatar.jpg'} 
                          alt={`${result.fullName}'s profile`}
                          onError={(e) => {
                            e.target.src = '/avatar.jpg';
                          }}
                        />
                      </div>
                      <div className="user-info">
                        <h4 className="user-name">{result.fullName}</h4>
                        <p className="user-username">@{result.username}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}

      <section id="about" className="about-section" ref={el => sectionsRef.current.about = el}>
        <div className="section-header">
          <h2>About Our Club</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">☁️</div>
            <span></span>
          </div>
        </div>
        
        <div className="about-content">
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-bullseye"></i>
            </div>
            <h3>Our Mission</h3>
            <p>To empower Wayne State students with AWS cloud skills, foster innovation, and connect members with industry opportunities.</p>
          </motion.div>
          
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-laptop-code"></i>
            </div>
            <h3>What We Do</h3>
            <p>We organize workshops, real world open-source project contributions, certification study groups, hackathons, and networking events with industry professionals.</p>
          </motion.div>
          
          <motion.div 
            className="about-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="about-card-icon">
              <i className="fas fa-cloud"></i>
            </div>
            <h3>Why AWS?</h3>
            <p>AWS leads cloud computing worldwide. Skills in AWS are highly sought after, offering students a competitive advantage in the job market. Open source projects are available for all students looking for a boost in their resume.</p>
          </motion.div>
        </div>
        
        <motion.div 
          className="stats-container"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="stat-item">
            <span className="stat-number">250+</span>
            <span className="stat-label">Club Members</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">6+</span>
            <span className="stat-label">Events Per Year</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">FREE</span>
            <span className="stat-label">Chances for Certifications</span>
          </div>
        </motion.div>
      </section>

      <section id="events" className="events-section" ref={el => sectionsRef.current.events = el}>
        <div className="section-header">
          <h2>Upcoming Events</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">📅</div>
            <span></span>
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="cta-secondary" onClick={handleCreateEventClick}>+ Create Event</button>
          </div>
        )}

        {eventsLoading ? (
          <motion.div 
            className="no-events-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
            style={{ textAlign: 'center', padding: '40px 20px' }}
          >
            Loading events...
          </motion.div>
        ) : events.length === 0 ? (
          <motion.div 
            className="no-events-message"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
            style={{
              textAlign: 'center',
              padding: '50px 20px',
              fontSize: '1.2rem',
              color: 'var(--text-secondary)',
              fontStyle: 'italic'
            }}
          >
            <div className="no-events-icon" style={{ fontSize: '3rem', marginBottom: '20px' }}>
              🗓️
            </div>
            <h3>Nothing to see here yet</h3>
            <p>Stay tuned for our upcoming events!</p>
          </motion.div>
        ) : (
          <div className="events-grid" data-count={events.length}>
            {events.map(ev => {
              const dt = new Date(ev.startTime);
              const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              return (
                <motion.div key={ev._id} className="event-card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true, amount: 0.2 }} onClick={() => setSelectedEvent(ev)}>
                  {ev.thumbnailUrl && (
                    <img src={ev.thumbnailUrl} alt={ev.title} style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700 }}>{ev.title}</div>
                    <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{formatted}</div>
                    {ev.meetupUrl && (
                      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                        <a href={ev.meetupUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="event-meetup-btn" title="Reserve your spot on Meetup">
                          <img src="/meetup.svg" alt="Meetup" />
                        </a>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        
        <motion.div 
          className="view-all-container"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true, amount: 0.1 }}
        >
          <button className="view-all-button" onClick={() => navigate('/events')}>View All Events</button>
        </motion.div>
      </section>

      {showCreateModal && isAdmin && <CreateEventModal />}
      {selectedEvent && <EventModal event={selectedEvent} />}

      <section id="resources" className="resources-section" ref={el => sectionsRef.current.resources = el}>
        <div className="section-header">
          <h2>Club Resources</h2>
          <div className="section-divider">
            <span></span>
            <div className="divider-icon">🔗</div>
            <span></span>
          </div>
        </div>
        
        <div className="resources-container">
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>AWS Free Tier Access</h3>
            <p>Get started with AWS services at no cost through our educational partnership.</p>
            <a href="#" className="resource-link">Access Now <i className="fas fa-arrow-right"></i></a>
          </motion.div>
          
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-certificate"></i>
            </div>
            <h3>Certification Vouchers</h3>
            <p>Active members may qualify for discounted AWS certification exam vouchers.</p>
            <a href="#" className="resource-link">Learn More <i className="fas fa-arrow-right"></i></a>
          </motion.div>
          
          <motion.div 
            className="resource-card"
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="resource-icon">
              <i className="fas fa-book"></i>
            </div>
            <h3>Learning Materials</h3>
            <p>Access our curated collection of guides, tutorials, and practice exercises.</p>
            <a href="#" className="resource-link">Browse Library <i className="fas fa-arrow-right"></i></a>
          </motion.div>
        </div>
        
        <motion.div 
          className="testimonials-container"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <h3>What Our Members Say</h3>
          <div className="testimonials-slider">
            <div className="testimonial">
              <p>Being on the board for the AWS Cloud Club really pushed me out of my comfort zone.
                 As a finance major, I wasn’t fluent in technology terms at first but organizing events 
                 helped me pick up so many concepts I wouldn’t have learned in the classroom. 
                It gave me the confidence to navigate technical conversations, which I rely on now in my role at Deloitte,
                 where I work closely with AWS in technology risk advisory practice.</p>
              <div className="testimonial-author">
                <img src="/mahdyya.jpeg" alt="Jane Doe" />
                <div>
                  <strong>Mahdyya Chowdury</strong>
                  <span>Finance, '25</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
      
      <section className="cta-section">
        <motion.div 
          className="cta-card"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true, amount: 0.5 }}
        >
          <h2>Ready to start your cloud journey?</h2>
          <p>Join our community today and get access to workshops, networking events, and resources to accelerate your career.</p>
          <button className="join-button pulse-animation" onClick={handleJoinClick}>
            Join the Club
          </button>
        </motion.div>
      </section>
      <SocialLinks />

      <Footer theme={theme} />
    </div>
  );
}

export default Landing;
