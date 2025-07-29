import { puzzleAPI } from '../config/api';  

export async function fetchPuzzleId() {
  try {
    const data = await puzzleAPI.createPuzzleId();
    return data.hashedId;
  } catch (err) {
    console.error('Failed to fetch puzzle ID:', err);
    return null;
  }
}
