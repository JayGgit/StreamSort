# Stream Sort
Computers are scary.

Sorting algorithms, such as bubble sort and quick sort rely on fancy equations done by computers.

What if we didn't need to rely on scary computers to sort numbers? This is where Stream Sort comes in.

> Ermmmmm computers never make mistakes 🤓🤓🤓

NOBODY'S TALKING TO YOU

Escape the matrix, and trust the most reliable people on Earth, Twitch streamers!

When Atrioc says right, we SORT RIGHT
If Ludwig says left, we SORT LEFT

---

**Made for [Github](https://github.com)'s and [Hack Club](https://hackclub.com)'s 2025 [Summer of Making](https://summer.hackclub.com/)**

---

## Setup (Windows)
1. Install dependencies listed below
	- (Optional) [Chocolatey Software Install](https://docs.chocolatey.org/en-us/choco/setup/) (Makes installing the below three easier)
	- [Node.js — Run JavaScript Everywhere](https://nodejs.org/en) (`choco install nodejs`)
	- [Installation - Streamlink 7.4.0 documentation](https://streamlink.github.io/install.html) (`choco install streamlink`)
	- [Download FFmpeg](https://ffmpeg.org/download.html) (`choco install ffmpeg`)
	- [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/downloads/#:~:text=Build%20Tools%20for%20Visual%20Studio%202022) (Scroll down, open "Tools for Visual Studio", then download "Build Tools for Visual Studio 2022")
	- ([Visual C++ Redistributables](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)) (Install both x86 and x64)
2. Create a .env file in the folder with... (Find credentials from [Twitch Developers](https://dev.twitch.tv/console/apps))
	- id=REPLACE_WITH_TWITCH_CLIENT_ID
	- secret=REPLACE_WITH_TWITCH_SECRET
3. Download the source code from [Releases · JayGgit/StreamSort](https://github.com/JayGgit/StreamSort/releases), and unzip
4. In the new unzipped folder, run `npm install`
5. Finally, run `node .` or `node index`

**Problems?**
1. Try restarting your computer. You'll be surprised how many problems this will solve.
2. Try installing [Visual C++ Redistributables](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170) again (INSTALL BOTH x86 AND x64, this isn't for redundancy).
3. Try switching to node version `22.14.0` and npm version `11.2.0` (These were versions that were verified to work, although many others, especially newer ones, should work fine).
4. Ask ChatGPT! If you encounter a problem, feel free to tell me, and I'll include it here!

## Setup (Mac / Linux)

Since node.js is cross platform, Stream Sort should work on these platforms, but have not been officially tested. If you manage to install this on these platforms, please tell me, and I'll update this guide!

## Credits
Stream Sort uses code from others. We are not affiliated with any of the below projects.

*Project (License)*

[Coolicons](https://coolicons.cool/) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/))

[StreamLink](https://streamlink.github.io/) ([BSD-2-Clause](https://opensource.org/license/bsd-2-clause))

[Xenova/whisper-tiny.en on Hugging Face](https://huggingface.co/Xenova/whisper-tiny.en) ([MIT License](https://mit-license.org/))

[FFmpeg](https://ffmpeg.org/) ([Various Licenses](https://ffmpeg.org/legal.html))

And various npm packages

