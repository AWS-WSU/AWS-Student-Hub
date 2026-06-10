import { useState, useRef, useCallback } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { eventsAPI } from '../utils/api';
import { Mail } from 'lucide-react';
import type { Event as HubEvent, EventFormPayload } from '../types/event';

type EventFormErrors = Partial<Record<'title' | 'date' | 'time', string>>;

type CropSource = {
  url: string;
  file: File;
};

type EmailStatus =
  | null
  | 'sending'
  | {
      success: true;
      sent: number;
      failed: number;
    }
  | {
      success: false;
      error: string;
    };

interface CreateEventModalProps {
  onClose: () => void;
  onEventCreated?: (event: HubEvent) => void;
}

const easternToISO = (dateStr: string, timeStr: string): string => {
  const testDate = new Date(`${dateStr}T12:00:00`);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    timeZoneName: 'shortOffset',
  });
  const parts = formatter.formatToParts(testDate);
  const offsetPart = parts.find((p) => p.type === 'timeZoneName');
  const offsetMatch = offsetPart?.value?.match(/GMT([+-]?\d+)/);
  const offsetHours = offsetMatch ? parseInt(offsetMatch[1], 10) : -5;
  const sign = offsetHours >= 0 ? '+' : '-';
  const absHours = Math.abs(offsetHours).toString().padStart(2, '0');
  const offsetStr = `${sign}${absHours}:00`;

  return new Date(`${dateStr}T${timeStr}:00${offsetStr}`).toISOString();
};

function CreateEventModal({ onClose, onEventCreated }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isRemote, setIsRemote] = useState(true);
  const [zoomLink, setZoomLink] = useState('');
  const [address, setAddress] = useState('');
  const [directions, setDirections] = useState('');
  const [locationName, setLocationName] = useState('');
  const [meetupUrl, setMeetupUrl] = useState('');
  const [thumbnail] = useState<File | Blob | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<EventFormErrors>({});
  const [sendEmailNotification, setSendEmailNotification] = useState(false);
  const [emailCustomMessage, setEmailCustomMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState<EmailStatus>(null);

  const [cropSrc, setCropSrc] = useState<CropSource | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCropSrc({ url, file: f });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedBlob(null);
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area): void => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<Blob | null> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.addEventListener('load', () => resolve(img));
      img.addEventListener('error', () => reject(new Error('Failed to load image for cropping')));
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

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

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.95
      );
    });
  };

  const saveCropped = async (): Promise<void> => {
    if (!croppedAreaPixels || !cropSrc) return;
    const blob = await createCroppedImage(cropSrc.url, croppedAreaPixels);
    if (!blob) return;
    setCroppedBlob(blob);
    setCropSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validateForm = (): boolean => {
    const newErrors: EventFormErrors = {};
    if (!title.trim()) newErrors.title = 'Title is required';
    if (!date) newErrors.date = 'Date is required';
    if (!time) newErrors.time = 'Time is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (): Promise<void> => {
    if (!validateForm()) return;

    setSubmitting(true);
    setEmailStatus(null);
    try {
      const startTime = easternToISO(date, time);
      const payload: EventFormPayload = {
        title,
        startTime,
        isRemote: String(isRemote),
        meetupUrl,
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

      onEventCreated?.(res.event);

      if (sendEmailNotification && res.event?._id) {
        setEmailStatus('sending');
        try {
          const emailRes = await eventsAPI.sendNotification(res.event._id, emailCustomMessage);
          setEmailStatus({
            success: true,
            sent: emailRes.emailsSent ?? 0,
            failed: emailRes.emailsFailed ?? 0,
          });
          setTimeout(() => onClose(), 2000);
        } catch (emailError) {
          console.error('Error sending email notifications:', emailError);
          setEmailStatus({
            success: false,
            error:
              emailError instanceof Error ? emailError.message : 'Unable to send notifications',
          });
          setTimeout(() => onClose(), 3000);
        }
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error creating event:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const emailResult = typeof emailStatus === 'object' && emailStatus !== null ? emailStatus : null;

  return (
    <div className="hub-modal-overlay" onClick={onClose}>
      <div className="hub-modal" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
        <div className="hub-modal-header">Create Event</div>
        <div className="hub-modal-content">
          <div className="hub-form-row">
            <label>Title *</label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
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
                onChange={(e) => {
                  setDate(e.target.value);
                  if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
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
                onChange={(e) => {
                  setTime(e.target.value);
                  if (errors.time) setErrors((prev) => ({ ...prev, time: '' }));
                }}
                className={errors.time ? 'input-error' : ''}
              />
              {errors.time && <span className="error-message">{errors.time}</span>}
            </div>
          </div>
          <div className="hub-form-row">
            <label>Location</label>
            <div className={`hub-toggle ${isRemote ? 'remote-selected' : 'inperson-selected'}`}>
              <button
                className={`hub-toggle-btn ${isRemote ? 'active' : ''}`}
                onClick={() => setIsRemote(true)}
              >
                Remote
              </button>
              <button
                className={`hub-toggle-btn ${!isRemote ? 'active' : ''}`}
                onClick={() => setIsRemote(false)}
              >
                In Person
              </button>
            </div>
          </div>
          {isRemote ? (
            <div className="hub-form-row">
              <label>Zoom/Webinar Link</label>
              <input
                value={zoomLink}
                onChange={(e) => setZoomLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
          ) : (
            <>
              <div className="hub-form-row">
                <label>Location Name</label>
                <input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Building/Room"
                />
              </div>
              <div className="hub-form-row">
                <label>Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, State"
                />
              </div>
              <div className="hub-form-row">
                <label>Directions (max 250)</label>
                <textarea
                  value={directions}
                  onChange={(e) => setDirections(e.target.value.slice(0, 250))}
                  rows={3}
                />
              </div>
            </>
          )}
          <div className="hub-form-row">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Tell people what to expect"
            />
          </div>
          <div className="hub-form-row">
            <label>Meetup Link</label>
            <input
              value={meetupUrl}
              onChange={(e) => setMeetupUrl(e.target.value)}
              placeholder="https://www.meetup.com/..."
            />
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
                background: sendEmailNotification
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'var(--bg-secondary)',
                borderRadius: '10px',
                border: sendEmailNotification ? '2px solid #22c55e' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
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
                  transition: 'background 0.2s ease',
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
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                  {sendEmailNotification ? (
                    <>
                      <Mail size={16} /> Email notifications enabled
                    </>
                  ) : (
                    <>
                      <Mail size={16} /> Send email to all members
                    </>
                  )}
                </div>
                <div
                  style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}
                >
                  {sendEmailNotification
                    ? 'All registered members will receive an email about this event'
                    : 'Toggle to notify all registered members about this event'}
                </div>
              </div>
            </div>
            {sendEmailNotification && (
              <div style={{ marginTop: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                  }}
                >
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
                    fontFamily: 'inherit',
                  }}
                  onClick={(e: MouseEvent<HTMLTextAreaElement>) => e.stopPropagation()}
                />
                <div
                  style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}
                >
                  This message will appear at the top of the email, before the event details.
                </div>
              </div>
            )}
            {emailStatus === 'sending' && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: '#3b82f6',
                }}
              >
                <div className="loading-dots" style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                  <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                  <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
                </div>
                Sending email notifications...
              </div>
            )}
            {emailResult?.success && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  borderRadius: '8px',
                  color: '#22c55e',
                  fontWeight: 500,
                }}
              >
                Successfully sent {emailResult.sent} emails!
                {emailResult.failed > 0 && ` (${emailResult.failed} failed)`}
              </div>
            )}
            {emailResult?.success === false && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontWeight: 500,
                }}
              >
                Failed to send emails: {emailResult.error}
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
                  style={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    display: 'block',
                    borderRadius: 8,
                  }}
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
                <div
                  style={{ position: 'relative', width: '100%', height: 400, background: '#000' }}
                >
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
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 8,
                      fontSize: 14,
                      color: 'var(--text-primary)',
                    }}
                  >
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
                  <button type="button" onClick={saveCropped} className="hub-btn">
                    Crop & Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCropSrc(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="hub-btn ghost"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="hub-modal-actions">
            <button className="hub-btn ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button className="hub-btn primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateEventModal;
