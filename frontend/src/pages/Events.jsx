import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { eventsAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';

function Events({ theme, toggleTheme }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const EventModal = ({ event }) => {
    if (!event) return null;
    const dt = new Date(event.startTime);
    const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    return (
      <div className="modal-overlay" onClick={() => setSelected(null)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <h3>{event.title}</h3>
          {event.thumbnailUrl && (
            <img src={event.thumbnailUrl} alt={event.title} style={{ width: '100%', height: 'auto', borderRadius: 8, marginBottom: 12 }} />
          )}
          <div style={{ marginBottom: 8 }}>
            <strong>{formatted}</strong>
          </div>
          {event.isRemote ? (
            <a href={event.zoomLink} target="_blank" rel="noreferrer">Join webinar</a>
          ) : (
            <div>
              {event.locationName && <div>{event.locationName}</div>}
              {event.address && <div>{event.address}</div>}
              {event.directions && <div style={{ marginTop: 6 }}>{event.directions}</div>}
            </div>
          )}
          {event.meetupUrl && (
            <a href={event.meetupUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#d62828', color: '#fff', padding: '10px 14px', borderRadius: 8, marginTop: 16 }}>
              <img src="/meetup.svg" alt="Meetup" style={{ width: 20, height: 20 }} />
              Reserve your spot at this event here!
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="landing-container">
      <Navbar 
        theme={theme} 
        toggleTheme={toggleTheme} 
        activeSection={''}
        scrollToSection={() => {}}
        themeIcon={theme === 'light' ? "/dark.svg" : "/light.svg"}
      />
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
          <div className="events-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {events.map(ev => {
              const dt = new Date(ev.startTime);
              const formatted = dt.toLocaleString('en-US', { timeZone: 'America/Detroit', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
              return (
                <div key={ev._id} className="event-card" onClick={() => setSelected(ev)} style={{ cursor: 'pointer', background: 'var(--card-bg)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  {ev.thumbnailUrl && (
                    <img src={ev.thumbnailUrl} alt={ev.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
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
      <Footer theme={theme} />
      {selected && <EventModal event={selected} />}
    </div>
  );
}

export default Events;


