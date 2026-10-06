import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function main() {
  try {
    console.log('Querying Firestore auditRecords...');
    const q = query(collection(db, 'auditRecords'), limit(20));
    const snap = await getDocs(q);
    console.log('Docs found:', snap.size);
    snap.forEach(d => {
      const data = d.data();
      console.log('--- DOC:', d.id);
      console.log('remitoId:', data.remitoId);
      console.log('description:', data.description);
      console.log('workPoint:', data.workPoint);
      console.log('keys:', Object.keys(data));
      // Print any field that has text that looks like description
      for (const [k, v] of Object.entries(data)) {
        if (typeof v === 'string' && v.length > 5 && k !== 'id' && k !== 'remitoId' && k !== 'date' && k !== 'clientName') {
          console.log(`  ${k}: ${v}`);
        }
      }
    });
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
