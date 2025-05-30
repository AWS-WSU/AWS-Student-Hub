// Simple in-memory storage fallback for when MongoDB is not available
class MemoryStorage {
  constructor() {
    this.newsletters = new Map();
  }

  async findOne(query) {
    const email = query.email;
    return this.newsletters.get(email) || null;
  }

  async save(data) {
    const email = data.email;
    const subscription = {
      email: email,
      subscribedAt: new Date(),
      isActive: true,
      ...data
    };
    this.newsletters.set(email, subscription);
    return subscription;
  }

  async findAll() {
    return Array.from(this.newsletters.values()).filter(sub => sub.isActive);
  }

  async updateOne(email, updates) {
    const existing = this.newsletters.get(email);
    if (existing) {
      Object.assign(existing, updates);
      this.newsletters.set(email, existing);
      return existing;
    }
    return null;
  }
}

module.exports = new MemoryStorage();
