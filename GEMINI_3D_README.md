# Gemini AI 3D Molecular Visualization Setup

## Overview
This project now uses Google's Gemini AI API to generate enhanced 3D molecular structures from SMILES notation.

## Setup Instructions

### 1. Get Gemini API Key
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key

### 2. Configure Environment
1. Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application
```bash
npm run dev
```

## Features

### AI-Enhanced 3D Visualization
- **Gemini API Integration**: Uses Google's Gemini 1.5 Flash model to generate optimal 3D coordinates
- **Intelligent Bond Angles**: AI calculates accurate tetrahedral, trigonal, and linear geometries
- **Ring Planarity**: Proper handling of aromatic systems
- **Natural Conformations**: AI suggests energetically favorable 3D arrangements

### Fallback Mechanism
If the Gemini API is unavailable or fails:
- Automatically falls back to local force-directed algorithm
- Ensures uninterrupted functionality
- No user intervention required

### API Endpoints

#### Generate 3D Structure
```
POST /api/gemini/generate-3d
Body: { "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "name": "Caffeine" }
```

#### Get Molecular Insights
```
POST /api/gemini/insights
Body: { "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "name": "Caffeine" }
```

## Usage

1. Enter a SMILES notation in the compound input field
2. The system will:
   - Send the SMILES to Gemini API
   - Receive AI-generated 3D coordinates
   - Render the enhanced 3D structure
   - Display "✨ AI-Enhanced" badge if successful

3. Features:
   - **Drag to Rotate**: Click and drag to rotate the molecule
   - **Reset**: Click the reset button to return to original view
   - **Download**: Export as PNG image
   - **Fullscreen**: View in larger modal

## Examples

### Caffeine
```
SMILES: CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

### Benzene
```
SMILES: c1ccccc1
```

### Aspirin
```
SMILES: CC(=O)OC1=CC=CC=C1C(=O)O
```

## Troubleshooting

### API Key Not Working
- Verify the key is correct in `.env`
- Restart the dev server after changing `.env`
- Check API quota limits in Google AI Studio

### Fallback to Local Generation
If you see structures without "AI-Enhanced" badge:
- Check console for error messages
- Verify internet connection
- Check Gemini API status

### Rate Limiting
Gemini API has rate limits:
- Free tier: 60 requests per minute
- Structures are generated once per compound
- Results can be cached client-side

## Architecture

```
Client (React)
  ↓ SMILES Input
  ↓ POST /api/gemini/generate-3d
Server (Express)
  ↓ Call Gemini API
  ↓ Parse AI Response
  ↓ Return Enhanced Coordinates
Client
  ↓ Render 3D Structure
  ↓ Apply Rotation/Interaction
```

## Benefits of AI Generation

1. **Accuracy**: Better bond angles and spatial arrangements
2. **Chemical Knowledge**: Understands molecular geometry rules
3. **Optimization**: Energetically favorable conformations
4. **Insights**: Additional chemical insights available via `/insights` endpoint

## Cost Considerations

- Gemini 1.5 Flash is optimized for speed and cost
- Free tier available with generous limits
- Production: Consider caching results to minimize API calls

## Future Enhancements

- [ ] Cache Gemini results in database
- [ ] Show molecular insights in UI
- [ ] Support for multiple conformers
- [ ] Energy minimization visualization
- [ ] Comparison view (AI vs local generation)

## Support

For issues or questions:
1. Check the console for error messages
2. Verify API key configuration
3. Test with simple molecules first (e.g., water: O, methane: C)
