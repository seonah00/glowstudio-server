import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import analyzeRouter from './routes/analyze'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://glowstudio-web.vercel.app',
    /\.vercel\.app$/,
  ],
}))
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }))
app.use('/analyze', analyzeRouter)

app.listen(PORT, () => console.log(`GlowStudio Server running on :${PORT}`))
