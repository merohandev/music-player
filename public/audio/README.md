# Audio Files

## Adding Your Audio File

1. Place your audio file in this directory (`public/audio/`)
2. Name it `sample.mp3` (or update the filename in `src/App.tsx` line 56)
3. Supported formats: MP3, WAV, OGG, M4A

## Current Configuration

The music player is configured to load: `/audio/sample.mp3`

To change the audio file:
1. Either rename your file to `sample.mp3`
2. Or update the fetch URL in `src/App.tsx`:
   ```typescript
   const response = await fetch('/audio/your-filename.mp3');
   ```

## Example Audio Files

You can use any audio file you have, or download free music from:
- [Freesound.org](https://freesound.org)
- [Zapsplat.com](https://zapsplat.com)
- [YouTube Audio Library](https://www.youtube.com/audiolibrary)

Make sure you have the rights to use any audio file you choose. 