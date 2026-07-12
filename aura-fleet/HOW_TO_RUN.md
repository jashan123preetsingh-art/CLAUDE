# How to run the Auto Moto Mobility Solutions CRM

*Written for someone who has never used a terminal. Total time: ~10 minutes, once.*

---

## Part 1 — Install Node.js (one time only)

Node.js is the free program that runs the CRM. Installing it is like installing any app.

1. Open your browser and go to **https://nodejs.org**
2. Click the big green button that says **LTS** (recommended version).
3. Open the downloaded file and keep clicking **Next → Next → Install → Finish**. Don't change any options.
4. **Restart your computer** (important — Windows needs this to find Node).

## Part 2 — Download the CRM (one time only)

1. Open this link in your browser — it downloads the whole project as a ZIP:

   **https://github.com/jashan123preetsingh-art/CLAUDE/archive/refs/heads/claude/aura-fleet-model-j4guhg.zip**

2. Go to your **Downloads** folder. You'll see a file like `CLAUDE-claude-aura-fleet-model-j4guhg.zip`.
3. **Right-click it → Extract All → Extract.**
4. Open the extracted folder, then open the folder inside it, then open the **`aura-fleet`** folder. Move this `aura-fleet` folder somewhere permanent, like your Desktop.

## Part 3 — Start the CRM

**Windows:** inside the `aura-fleet` folder, double-click **`START-WINDOWS.bat`**.

- If Windows shows a blue "Windows protected your PC" box: click **More info → Run anyway**. (It's your own file — Windows just doesn't recognise it.)
- The first time, a black window will download packages for 1–2 minutes. This happens only once.
- Then your browser opens the CRM automatically at `http://localhost:5173`.

**Mac:** open the Terminal app, type `bash `, drag the file `start-mac-linux.sh` into the window, press Enter.

## Daily use

- Double-click **`START-WINDOWS.bat`** → browser opens → work.
- **Keep the black window open** while you use the app. Closing it stops the CRM.
- Everything you enter (cars, drivers, settlements, expenses, clients) **saves automatically** in your browser — it's all still there next time.
- Always use the **same browser on the same computer**, because the data lives in that browser.

## If something goes wrong

| Problem | Fix |
|---|---|
| Black window says "Node.js is not installed" | Do Part 1, restart the computer, try again |
| `'npm' is not recognized` | Node didn't install properly — reinstall from nodejs.org and restart |
| Browser shows "can't connect" | Wait 5 seconds and refresh — the app was still starting |
| Blue "Windows protected your PC" box | More info → Run anyway |
| Want to start fresh with sample data | Scroll to the bottom of the app → "Reset to sample data" |

---

*Easier option: this CRM can also be put on a free live web link so it opens like any website on any phone or laptop — no installation at all. Ask for "deploy" when you want that.*
