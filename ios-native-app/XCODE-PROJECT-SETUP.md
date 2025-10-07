# Creating the Xcode Project

Since I can't directly create an Xcode project from Windows, you'll need to do this step on your Mac. It's super easy!

## On Your Mac

### Step 1: Create New Project

1. Open **Xcode**
2. Click **File** → **New** → **Project**
3. Choose **iOS** tab at the top
4. Select **App** template
5. Click **Next**

### Step 2: Configure Project

Fill in these details:
- **Product Name:** `BeamShare`
- **Team:** Select your Apple ID
- **Organization Identifier:** `com.yourname` (use your name or company)
- **Bundle Identifier:** (auto-filled, should be like `com.yourname.BeamShare`)
- **Interface:** SwiftUI
- **Language:** Swift
- **Storage:** None (uncheck Core Data)
- **Include Tests:** Uncheck both boxes

Click **Next**

### Step 3: Save Location

1. Navigate to: `~/Desktop/screenshare/ios-native-app/`
2. **UNCHECK** "Create Git repository"
3. Click **Create**

### Step 4: Copy Files

In Finder, you should see a `BeamShare` folder was created with some default files.

**Delete these default files:**
- `ContentView.swift` (we have our own)
- `BeamShareApp.swift` (we have our own)

**Copy our files into the BeamShare folder:**

From `ios-native-app/BeamShare/` to the new `BeamShare/BeamShare/` folder:
- `BeamShareApp.swift`
- `ContentView.swift`
- `HostSession.swift`
- `ScreenCaptureManager.swift`
- `SignalingTypes.swift`
- `WebRTCManager.swift`
- `WebSocketManager.swift`

**Also copy:**
- `Info.plist` (replaces the existing one)
- `Podfile` (goes in the project root, same level as BeamShare.xcodeproj)

### Step 5: Add Files to Xcode

1. In Xcode's left sidebar (Project Navigator), **right-click** the **BeamShare** folder (the yellow one)
2. Choose **Add Files to "BeamShare"...**
3. Select ALL the Swift files you just copied
4. Make sure **"Copy items if needed"** is CHECKED
5. Make sure **"BeamShare" target** is CHECKED
6. Click **Add**

### Step 6: Install CocoaPods

1. Open **Terminal** on your Mac
2. Navigate to your project:
   ```bash
   cd ~/Desktop/screenshare/ios-native-app/BeamShare
   ```
3. Install CocoaPods (if you don't have it):
   ```bash
   sudo gem install cocoapods
   ```
4. Install dependencies:
   ```bash
   pod install
   ```

### Step 7: Close and Reopen

1. **Close Xcode completely**
2. In Finder, navigate to your project folder
3. **Double-click `BeamShare.xcworkspace`** (NOT .xcodeproj!)
4. From now on, ALWAYS open the `.xcworkspace` file

### Step 8: Add Capabilities

1. In Xcode, click the blue **BeamShare** icon in the left sidebar
2. Select **BeamShare** under TARGETS
3. Click **Signing & Capabilities** tab
4. Click **+ Capability** button
5. Search for and add:
   - **App Groups** (for WebRTC)
   - **Background Modes** (check "Audio, AirPlay, and Picture in Picture")

For App Groups:
- Click the **+** button in the App Groups section
- Enter: `group.com.yourname.BeamShare` (replace yourname with your actual bundle ID part)

### Step 9: Build Settings

1. Still in project settings, click **Build Settings** tab
2. Search for "Bitcode"
3. Set **Enable Bitcode** to **No**

### Step 10: Try Building!

1. Connect your iPad
2. Select your iPad in the device dropdown (top-left, near Play button)
3. Click the **Play** button (▶️)
4. Wait for build...
5. Trust the certificate on iPad if needed
6. App should launch!

---

## File Structure You Should Have

```
BeamShare/
├── BeamShare.xcodeproj
├── BeamShare.xcworkspace  ← OPEN THIS
├── Podfile
├── Pods/
└── BeamShare/
    ├── BeamShareApp.swift
    ├── ContentView.swift
    ├── HostSession.swift
    ├── ScreenCaptureManager.swift
    ├── SignalingTypes.swift
    ├── WebRTCManager.swift
    ├── WebSocketManager.swift
    ├── Info.plist
    └── Assets.xcassets/
```

---

## Common Issues

**"No such module 'WebRTC'"**
- Did you run `pod install`?
- Are you opening the `.xcworkspace` file (not `.xcodeproj`)?

**"Failed to code sign"**
- Did you select your Team in Signing & Capabilities?
- Try changing the bundle identifier

**Build errors about missing imports**
- Make sure all Swift files are added to the target
- Check that WebRTC pod installed correctly

---

Once you complete these steps, follow the **COMPLETE-SETUP-GUIDE.md** for building and running on your iPad!
