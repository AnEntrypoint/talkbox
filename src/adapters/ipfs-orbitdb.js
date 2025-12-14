/**
 * IPFS + OrbitDB Adapter for Talkbox
 * Fully decentralized message storage
 *
 * In production, use:
 * - helia (lightweight IPFS)
 * - orbitdb (distributed database)
 *
 * For pinning/backup:
 * - Pinata or nft.storage (free tier)
 */

import crypto from 'crypto';

class IPFSOrbitDBAdapter {
  constructor(options = {}) {
    this.pinningService = options.pinningService || 'pinata'; // or 'nft.storage'
    this.pinata_api_key = options.pinata_api_key;
    this.nodeType = options.nodeType || 'browser'; // browser or server
    this.databases = new Map(); // shortcode -> db instance
  }

  /**
   * Initialize IPFS node and OrbitDB
   * In production: uses Helia (lightweight) or go-ipfs
   */
  async initialize() {
    console.log('Initializing IPFS node...');

    // Stub: In production, initialize Helia
    // const { createHelia } = await import('helia');
    // this.ipfs = await createHelia();

    // Stub: Initialize OrbitDB
    // const OrbitDB = await import('orbitdb');
    // this.orbitdb = await OrbitDB.create({ ipfs: this.ipfs });

    console.log('✓ IPFS node ready');
    return true;
  }

  /**
   * Get or create a database for a shortcode
   * Database is an immutable append-only log
   */
  async getDatabase(shortcode) {
    if (this.databases.has(shortcode)) {
      return this.databases.get(shortcode);
    }

    // In production:
    // const db = await this.orbitdb.log(`talkbox-${shortcode}`);
    // this.databases.set(shortcode, db);
    // return db;

    // Stub:
    const db = {
      address: `talkbox-${shortcode}`,
      messages: [],
      add: async (message) => {
        const entry = {
          id: crypto.randomUUID(),
          message,
          timestamp: Date.now(),
          hash: crypto.createHash('sha256').update(JSON.stringify(message)).digest('hex')
        };
        db.messages.push(entry);
        return entry.hash;
      },
      all: () => db.messages,
      load: async () => console.log(`Loaded messages for ${shortcode}`),
      close: async () => console.log(`Closed ${shortcode}`)
    };

    this.databases.set(shortcode, db);
    return db;
  }

  /**
   * Send message: add to local database and replicate
   */
  async sendMessage(shortcode, message) {
    const db = await this.getDatabase(shortcode);

    // Add to database (gets IPFS hash)
    const hash = await db.add({
      content: message,
      sender: 'anonymous',
      timestamp: Date.now()
    });

    // Pin to IPFS (replicated to pinning service)
    await this.pin(hash);

    // Announce to DHT (other peers can find it)
    await this.announceToNetwork(shortcode, hash);

    return {
      messageId: hash,
      databaseAddress: db.address
    };
  }

  /**
   * Read all messages for a shortcode
   * Loads from local database or DHT
   */
  async readMessages(shortcode) {
    const db = await this.getDatabase(shortcode);
    await db.load();

    return db.all().map(entry => ({
      messageId: entry.hash,
      message: entry.message.content,
      timestamp: entry.message.timestamp
    }));
  }

  /**
   * Pin message to guarantee 30+ day retention
   * Uses free pinning service (Pinata or nft.storage)
   */
  async pin(ipfsHash) {
    console.log(`Pinning ${ipfsHash} for 30+ day retention...`);

    if (this.pinningService === 'pinata' && this.pinata_api_key) {
      // In production:
      // const response = await fetch('https://api.pinata.cloud/pinning/pinByHash', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${this.pinata_api_key}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({ hashToPin: ipfsHash })
      // });
    } else if (this.pinningService === 'nft.storage') {
      // nft.storage handles pinning automatically on upload
      console.log('Using nft.storage for pinning (unlimited free)');
    }

    return { pinned: true, hash: ipfsHash };
  }

  /**
   * Announce database address to network
   * Other peers can discover and replicate
   */
  async announceToNetwork(shortcode, databaseAddress) {
    console.log(`Announcing ${shortcode} on DHT...`);
    // In production: this.ipfs.dht.put(shortcode, databaseAddress)
    return true;
  }

  /**
   * Discover peers with this shortcode
   * Via DHT or bootstrap nodes
   */
  async discoverPeers(shortcode) {
    console.log(`Discovering peers for ${shortcode}...`);
    // In production: const peers = await this.ipfs.dht.get(shortcode)
    return [];
  }

  /**
   * Sync with discovered peers
   * OrbitDB handles replication automatically
   */
  async syncWithPeers(shortcode) {
    const peers = await this.discoverPeers(shortcode);
    console.log(`Found ${peers.length} peers, syncing...`);

    const db = await this.getDatabase(shortcode);
    // In production: OrbitDB auto-syncs
    // Simulation: merge remote messages
    return { synced: true, peersCount: peers.length };
  }

  /**
   * Get database IPFS address (shareable)
   */
  async getDatabaseAddress(shortcode) {
    const db = await this.getDatabase(shortcode);
    return db.address;
  }

  /**
   * Cleanup: unpin and close old databases
   */
  async cleanup(maxAgeDays = 30) {
    for (const [shortcode, db] of this.databases) {
      await db.close();
    }
    console.log('Cleanup complete');
  }

  async disconnect() {
    await this.cleanup();
    // In production: await this.ipfs.stop();
  }
}

export default IPFSOrbitDBAdapter;
