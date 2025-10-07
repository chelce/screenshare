# BeamShare Native iOS App - Complete Setup Guide

## 🎯 What This Is
A **native Swift iOS app** that captures your iPad screen and streams it to any web browser using your self-hosted server. No third-party services, no security flags.

## 📋 What You'll Need
1. **Mac computer** (MacBook, iMac, Mac Mini - any Mac running macOS)
2. **Xcode** (free from Mac App Store)
3. **Apple ID** (your regular Apple account - free)
4. **iPad** to test on
5. **USB cable** to connect iPad to Mac

## 🚀 Step-by-Step Setup (Beginner-Friendly)

### Part 1: Install Xcode on Your Mac

1. Open **App Store** on your Mac
2. Search for "Xcode"
3. Click **Get** (it's free, ~15GB download)
4. Wait for it to install (takes 20-30 minutes)
5. Open Xcode once installed
6. Accept the license agreement
7. Wait for "Installing components..." to finish

### Part 2: Get the Project Files

1. On your Mac, open **Terminal** (search for it in Spotlight)
2. Run these commands:

```bash
# Navigate to Desktop
cd ~/Desktop

# Clone your project
git clone https://github.com/chelce/screenshare.git

# Go to the iOS app folder
cd screenshare/ios-native-app
```

### Part 3: Install WebRTC Dependency

```bash
# Install CocoaPods (dependency manager for iOS)
sudo gem install cocoapods

# Install WebRTC framework
pod install
```

### Part 4: Open in Xcode

1. In the `ios-native-app` folder, **double-click** `BeamShare.xcworkspace`
2. Xcode will open the project

### Part 5: Configure Your Apple ID

1. In Xcode, click **Xcode** menu → **Settings**
2. Click **Accounts** tab
3. Click the **+** button at bottom left
4. Choose **Apple ID**
5. Sign in with your regular Apple account
6. Close the settings window

### Part 6: Set Up Code Signing

1. In Xcode's left sidebar, click the blue **BeamShare** icon at the top
2. Click **BeamShare** under TARGETS (not PROJECTS)
3. Click **Signing & Capabilities** tab
4. Check the box: **Automatically manage signing**
5. For **Team**, select your name (your Apple ID)
6. Xcode will automatically create a bundle identifier

**If you see errors:**
- The bundle ID might be taken
- Change it to: `com.YOURNAME.beamshare` (use your actual name)
- Click anywhere else, Xcode will retry

### Part 7: Connect Your iPad

1. Connect iPad to Mac with USB cable
2. On iPad, unlock it
3. You'll see "Trust This Computer?" → Tap **Trust**
4. Enter your iPad passcode
5. In Xcode, at the top near the Play button, click the device dropdown
6. Select your iPad's name

### Part 8: Build and Run

1. Click the **Play button** (▶️) in Xcode's top-left corner
2. Wait for "Building..." to finish (2-5 minutes first time)
3. You'll see an error on iPad: **"Untrusted Developer"**

**Fix the error:**
1. On iPad: **Settings** → **General** → **VPN & Device Management**
2. Tap your Apple ID under "Developer App"
3. Tap **Trust "Your Name"**
4. Tap **Trust** again to confirm
5. Go back to Xcode and click Play (▶️) again

### Part 9: Test It!

1. App should launch on your iPad
2. Tap **"Start Sharing"**
3. Grant screen recording permission (only first time)
4. You'll see a 6-digit room code (like `483729`)
5. On any computer/phone browser, go to your web app
6. Enter the room code as a viewer
7. You should see your iPad screen! 🎉

## 🔄 TestFlight (Optional - For Distribution)

TestFlight lets you install the app without cables. I'll create a separate guide if you want this.

## 🐛 Troubleshooting

### "Failed to code sign"
- Make sure you selected your Team in Signing & Capabilities
- Try changing the bundle identifier

### "Could not launch BeamShare"
- Did you trust the developer certificate on iPad?
- Settings → General → VPN & Device Management

### "Unable to install"
- Make sure iPad is unlocked
- Try disconnecting and reconnecting the cable

### Screen recording permission denied
- iPad Settings → BeamShare → Enable Screen Recording

### Can't connect to server
- Make sure your Railway server is running
- Check the WebSocket URL in `WebSocketManager.swift`

## 📁 Project Files Included

- **BeamShare.xcodeproj** - Xcode project file
- **Podfile** - Dependency configuration (WebRTC)
- **Info.plist** - App permissions and settings
- **ContentView.swift** - Main app UI
- **HostSession.swift** - Screen sharing logic
- **WebSocketManager.swift** - Server connection
- **WebRTCManager.swift** - Video streaming
- **SignalingTypes.swift** - Message types (matches your web app)

## 🎓 Next Steps After Testing

1. **Customize the app** - Change colors, add your logo
2. **TestFlight setup** - Distribute without cables (I can guide you)
3. **App Store submission** - Make it public (optional, more complex)

## ❓ Need Help?

Common beginner questions:

**"I don't see my iPad in Xcode"**
- Is it connected with a cable?
- Did you unlock it and trust the computer?
- Try unplugging and plugging back in

**"The app crashes immediately"**
- Check Xcode's console (bottom panel) for errors
- Make sure ReplayKit capability is enabled

**"No video showing up for viewers"**
- Check Railway server logs
- Make sure WebSocket URL is correct
- Test on the same WiFi network first

**"Can I test without an iPad?"**
- Yes! Use the iOS Simulator (but screen recording won't actually work)
- In Xcode device dropdown, choose "iPhone 15 Pro" or any simulator

---

Don't worry if this seems like a lot! Once Xcode is set up, it's literally just:
1. Plug in iPad
2. Click Play button
3. Done!

I'm here to help with any step that's confusing. 😊
