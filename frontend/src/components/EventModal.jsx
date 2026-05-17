import { useState } from 'react';
import { eventsAPI } from '../utils/api';

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
  const offsetMatch = offsetPart?.value?.match(/GMT([+-]?\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1]) : -5;
  const sign = offsetHours >= 0 ? '+' : '-';
  const absHours = Math.abs(offsetHours).toString().padStart(2, '0');
  const offsetStr = `${sign}${absHours}:00`;
  
  return new Date(`${dateStr}T${timeStr}:00${offsetStr}`).toISOString();
};

function EventModal({ event, isAdmin, onClose, onEventUpdated, onEventDeleted }) {
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
      if (onEventUpdated) onEventUpdated(res.event);
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
      if (onEventDeleted) onEventDeleted(event._id);
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
    <div className="hub-modal-overlay" onClick={onClose}>
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
}

export default EventModal;
