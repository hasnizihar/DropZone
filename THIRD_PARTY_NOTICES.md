# Third-Party Software Notices and Licenses

DROPZONE incorporates, bundles, or interfaces with the following open-source third-party software components. This document provides notice and attribution in accordance with their respective licensing terms.

---

## 1. Third-Party Component Inventory

| Component | Version | License | Delivery Method | Source Repository / Project |
| :--- | :--- | :--- | :--- | :--- |
| **Electron** | 34.5.8 | MIT | Bundled Runtime | https://github.com/electron/electron |
| **Chromium** | 134.x | BSD-3-Clause | Embedded in Electron | https://chromium.googlesource.com/chromium/src |
| **Node.js** | 20.19.1 | MIT | Embedded in Electron | https://github.com/nodejs/node |
| **Python** | 3.12.10 | Python Software Foundation (PSF) | Bundled in Worker | https://www.python.org |
| **yt-dlp** | 2026.10.26 | The Unlicense | Bundled in Worker | https://github.com/yt-dlp/yt-dlp |
| **gallery-dl** | 1.32.17 | GNU General Public License v3.0 (GPL-3.0) | Bundled in Worker | https://github.com/mikf/gallery-dl |
| **requests** | 2.34.2 | Apache License 2.0 | Bundled in Worker | https://github.com/psf/requests |
| **psutil** | 7.2.2 | BSD-3-Clause | Bundled in Worker | https://github.com/giampaolo/psutil |
| **pydantic** | 2.14.1 | MIT | Bundled in Worker | https://github.com/pydantic/pydantic |
| **sql.js** | 1.16.0 | MIT | Inlined WebAssembly | https://github.com/sql-js/sql.js |
| **React** | 18.3.1 | MIT | Bundled Frontend | https://github.com/facebook/react |
| **Zustand** | 5.0.3 | MIT | Bundled Frontend | https://github.com/pmndrs/zustand |
| **Lucide Icons** | 1.16.0 | ISC | Bundled Frontend | https://github.com/lucide-icons/lucide |
| **Tailwind CSS** | 3.4.17 | MIT | Build-time Asset | https://github.com/tailwindlabs/tailwindcss |
| **FFmpeg / FFprobe** | 9.0.2 | GNU General Public License v3.0 (GPL-3.0) | System / External Dependency | https://ffmpeg.org / https://www.gyan.dev/ffmpeg |

---

## 2. Architectural Boundaries & GPL Compliance Notice

DROPZONE communicates with **`gallery-dl`** and **`FFmpeg`** strictly as separate subprocesses across standard I/O (JSON Lines IPC protocol and CLI command execution). DROPZONE does not link dynamically or statically against GPL C/C++ libraries.

- **`gallery-dl`**: In accordance with the GNU General Public License version 3.0, the source code for `gallery-dl` is available at https://github.com/mikf/gallery-dl. The companion source code for DROPZONE's Python worker service is provided in full within the project repository (`backend/worker/src/dropzone_worker/services/gallery_service.py`).
- **`FFmpeg`**: DROPZONE does not redistribute FFmpeg directly in base installer packages to preserve compact distribution size and avoid proprietary codec redistribution restrictions. Users may leverage host-provided FFmpeg (e.g. via `winget install Gyan.FFmpeg`) or configure custom paths in Settings.

---

## 3. License Texts

### The MIT License
```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### The Unlicense (yt-dlp)
```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
```

### Apache License 2.0 (requests)
```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### BSD 3-Clause License (Chromium, psutil)
```text
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

### Python Software Foundation License (Python 3.12)
```text
PYTHON SOFTWARE FOUNDATION LICENSE VERSION 2
--------------------------------------------
1. This LICENSE AGREEMENT is between the Python Software Foundation ("PSF"), and
the Individual or Organization ("Licensee") accessing and otherwise using this
software ("Python") in source or binary form and its associated documentation.

2. Subject to the terms and conditions of this License Agreement, PSF hereby
grants Licensee a nonexclusive, royalty-free, world-wide license to reproduce,
analyze, test, perform and/or display publicly, prepare derivative works,
distribute, and otherwise use Python alone or in any derivative version,
provided, however, that PSF's License Agreement and PSF's notice of copyright,
i.e., "Copyright (c) 2001-2026 Python Software Foundation; All Rights Reserved"
are included in Python alone or in any derivative version prepared by Licensee.
```

### GNU General Public License Version 3.0 (gallery-dl, FFmpeg)
```text
GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies
of this license document, but changing it is not allowed.

The complete text of the GNU General Public License v3.0 is available at:
https://www.gnu.org/licenses/gpl-3.0.txt
```

