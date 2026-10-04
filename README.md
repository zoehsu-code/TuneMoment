# 🎵 TuneMoment

### Turn moments into music.

**TuneMoment is an AI-native social platform that understands your videos and creates original soundtracks around the moments inside them.**

Upload a video. TuneMoment watches what happens, understands how the moment unfolds over time, and composes music that moves with it.

Built at **MHacks 2026**.

---
## 🎬 Demo

### From video to soundtrack

Play either video below to compare the baseline with our method. Both videos include sound.

<table>
  <tr>
    <th width="50%">Baseline — bananaMOV</th>
    <th width="50%">Ours — TuneMoment</th>
  </tr>
  <tr>
    <td><video src="https://github.com/user-attachments/assets/89c8cafc-15c2-4bae-b099-c575c9ba7d62" controls width="360"></video></td>
    <td><video src="https://github.com/user-attachments/assets/4190ad6f-146f-40a7-9457-beaec18ce786" controls width="360"></video></td>
  </tr>
</table>

## ✨ What is TuneMoment?

Finding the right music for a video is still surprisingly manual.

You scroll through songs, preview them one by one, trim them, and try to make the beat fit the moment.

TuneMoment flips that process around:

> **Instead of choosing music for your moment, your moment creates its own music.**

Upload a video and TuneMoment analyzes its motion, transitions, emotional progression, repeated patterns, and important events.

It then turns that understanding into a musical composition plan and generates an original soundtrack designed specifically for the video.

From there, users can:

- 🎵 Generate an original soundtrack
- 🔄 Regenerate for another interpretation
- 🎛️ Fine-tune the result in Studio
- 🚀 Publish the finished moment
- ❤️ Discover musical moments from other creators

---

## 🎬 How It Works

```text
              Video
                │
                ▼
     Multimodal Understanding
                │
                ▼
      Temporal Event Reasoning
                │
                ▼
       Composition Planning
                │
                ▼
        ElevenLabs Music
                │
                ▼
     Video + Original Soundtrack
                │
        ┌───────┼───────┐
        ▼       ▼       ▼
   Regenerate Publish  Studio
                │
                ▼
             Explore
```

### 1. Understand the video

TuneMoment sends the full video to a multimodal model that reasons about more than just what objects appear on screen.

It looks for things such as:

- motion and action
- scene transitions
- reveals
- repeated gestures
- editing rhythm
- emotional progression
- changes in visual intensity
- important moments
- overall narrative structure

### 2. Turn visual structure into musical structure

The model translates its understanding into a **composition plan**.

Rather than simply describing a genre or mood, the plan describes how the music should evolve over time:

- where energy should rise or fall
- where musical sections should change
- which visual events deserve musical emphasis
- what each part of the video should feel like

### 3. Compose original music

The composition plan is sent to **ElevenLabs Music**, which generates an original soundtrack while retaining creative freedom over melody, harmony, instrumentation, and texture.

### 4. Synchronize the experience

The generated soundtrack is paired with the original video so that musical changes correspond to meaningful visual moments.

The result feels like one finished piece of content rather than a video with a random song placed underneath it.

---

## 🧠 The Technical Challenge: Temporal Alignment

Understanding *what* happens in a video is only half the problem.

Music also has to understand **when** it happens.

A video might contain a transition, jump, reveal, camera movement, and impact within only a few seconds.

Those events do not always line up neatly with valid musical section boundaries.

TuneMoment solves this by separating:

**macro musical structure**

from

**fine-grained internal musical events**

```text
VIDEO

────────●────────●────────────
     takeoff    splash


MUSIC

[     Build       ][ Impact / Release ]
        ↑                  ↑
   internal cue      structural peak
```

Major events can define musical sections, while smaller but meaningful events can become precisely timed accents, flourishes, harmonic changes, or rhythmic cues inside those sections.

This lets TuneMoment preserve the real timing of the video without forcing every event into an artificial musical boundary.

---

## 🎨 Designed for Creative Freedom

Another challenge was deciding how much control to give the AI music generator.

If the composition plan specifies every instrument, note, and musical detail, the generated music becomes rigid.

If it says too little, the soundtrack may not follow the video.

TuneMoment instead focuses on four questions:

> **When does something happen?**  
> **Why does it matter?**  
> **How should the musical energy change?**  
> **What should the moment feel like?**

The music model is then free to decide exactly how to express that intent.

---

## 🏟️ What's Next: A Blind Multimodal Model Arena

TuneMoment is designed to eventually become more than a creation platform.

It can also become a **blind, real-world evaluation arena for multimodal AI models**.

Imagine that users upload videos normally, without knowing which multimodal model interprets them.

Behind the scenes:

```text
                    Video
                      │
              Randomized Routing
                ┌─────┴─────┐
                ▼           ▼
              Grok        Gemini
                │           │
                └─────┬─────┘
                      ▼
             Composition Plan
                      │
                      ▼
              Same Music Model
                      │
                      ▼
                User Behavior
          ┌───────────┼───────────┐
          ▼           ▼           ▼
     Regenerate    Publish      Studio
                      │
                      ▼
                   Explore
               ┌──────┼──────┐
               ▼      ▼      ▼
              Like  Share   Watch
```

Instead of asking users:

> *Which AI model do you think is better?*

TuneMoment could learn from what people actually do.

Potential preference signals include:

| Signal | What it may tell us |
| --- | --- |
| Regeneration rate | Was the first interpretation satisfying? |
| Number of regenerations | How quickly did the system reach something the creator liked? |
| Publish rate | Was the result good enough to share? |
| Studio edits | How much correction did the generated result require? |
| Likes | How did other viewers respond? |
| Shares | Was the final audiovisual result compelling? |
| Watch completion | Did the finished moment retain attention? |

Model identity could remain hidden from the user, reducing brand bias.

By keeping the downstream music model and generation settings controlled, TuneMoment could compare how different multimodal models understand real human moments.

### Why does this matter?

Traditional benchmarks usually ask whether a model can correctly answer questions about a fixed dataset.

Creative understanding is different.

There may be no single objectively correct soundtrack for a sunset, a skateboard jump, a travel montage, or a memory with friends.

The more interesting question is:

> **Which model consistently understands videos in a way that humans actually want to keep, publish, and share?**

TuneMoment could turn millions of everyday creative decisions into implicit human preference signals for multimodal AI.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────┐
│          TuneMoment             │
│                                 │
│   Create · Explore · Profile    │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│        Next.js Generation API   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   Multimodal Video Reasoning    │
│                                 │
│              Grok               │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Composition Planner       │
│                                 │
│   Structure · Timing · Energy   │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│        ElevenLabs Music         │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Synchronized Result       │
│                                 │
│          Video + Music          │
└─────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

- **Next.js 16**
- **React 19**
- **TypeScript**
- **Tailwind CSS 4**
- **Lucide React**
- **Base UI / shadcn**

### AI & Music

- **xAI Grok** — multimodal video understanding and composition planning
- **ElevenLabs Music** — soundtrack generation
- **Google Gemini SDK** — multimodal experimentation

### Backend & Data

- **Next.js server routes**
- **Neon**
- **Drizzle ORM**
- **Vercel Blob**
- **Clerk**

---

## 🚧 Challenges We Faced

### Understanding time, not just content

A model can recognize that a video contains a skateboarder or a beach, but a soundtrack needs to understand how the scene evolves second by second.

We designed TuneMoment around temporal reasoning rather than simple video captioning.

### Visual events don't always fit musical boundaries

Important visual events can happen only seconds apart.

Instead of moving those events to incorrect timestamps, TuneMoment uses hierarchical musical structure: major events shape sections while smaller events remain accurately timed inside them.

### Balancing control and creativity

Over-specifying music reduces the music model's creative freedom. Under-specifying it reduces synchronization.

Our composition plan therefore focuses on semantic intent, temporal structure, and energy rather than prescribing every musical detail.

### Making AI disappear

The underlying pipeline is technically complex, but the user experience should not be.

The product reduces the process to:

```text
Upload → Generate → Watch → Publish
```

Users never need to understand prompts, composition plans, APIs, or model parameters.

---

## 🏆 What We're Proud Of

TuneMoment combines:

- full-video multimodal understanding
- temporal event reasoning
- structured music composition planning
- original AI music generation
- synchronized video and soundtrack playback
- a consumer-first creation experience
- a social product vision
- a path toward real-world blind multimodal model evaluation

Most importantly, TuneMoment changes the starting point for AI music creation.

**The prompt is no longer a sentence.**

**The prompt is the moment itself.**

---

## 🔮 What's Next

We want to expand TuneMoment in two directions.

### A richer creative social platform

- personalized soundtrack generation
- richer Studio controls
- creator profiles
- social discovery
- collaborative creation
- soundtrack remixing

### A real-world multimodal evaluation platform

- randomized Grok vs. Gemini routing
- anonymous model evaluation
- regeneration-based preference signals
- controlled A/B experiments
- engagement-adjusted model comparisons
- preference dashboards for model developers

Our long-term question is:

> **What if the way people create and share moments could also teach us which AI models truly understand them?**

---

## 🚀 Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/zoehsu-code/jamhacks2026.git
cd jamhacks2026
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file and provide the required API credentials.

Never commit API keys to the repository.

### 4. Start the development server

```bash
npm run dev
```

Then open the local Next.js application in your browser.

### Build

```bash
npm run build
```

### Run tests

```bash
npm test
```

---

## 👩‍💻 Built at MHacks 2026

Built during **MHacks 2026**.

### TuneMoment

**Turn moments into music. 🎵**
