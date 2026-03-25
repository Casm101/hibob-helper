<a id="readme-top"></a>

[![Stars][stars-shield]][stars-url]
[![Forks][forks-shield]][forks-url]
[![Issues][issues-shield]][issues-url]

<br />
<div align="center">
  <a href="https://github.com/github_username/repo_name">
    <img src="public/icons/icon-128.png" alt="Logo" width="100" height="100">
  </a>
  <h3 align="center">HiBob Attendance Helper</h3>

  <p align="center">
    A Chrome extension that automates missing attendance entries in HiBob.
    <br />
    <br />
    <a href="https://github.com/Casm101/hibob-helper"><strong>Explore the repo</strong></a>
    &middot;
    <a href="https://github.com/Casm101/hibob-helper/issues/new?labels=bug">Report Bug</a>
    &middot;
    <a href="https://github.com/Casm101/hibob-helper/issues/new?labels=enhancement">Request Feature</a>
  </p>

  <p align="center">
    Chrome Web Store listing: <a href="https://chromewebstore.google.com/detail/hibob-attendance-helper/mefckcggfgogjpmjdbaimdmfjnegnloa?hl=en&authuser=0" target="_blank noreferrer">v1.2.0</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

HiBob Attendance Helper is a Chrome Manifest V3 extension for filling missing attendance entries on HiBob's `My Attendance` page.

Current functionality includes:

- Popup-based automation with saved clock-in and clock-out defaults
- Inline floating controls on the supported HiBob attendance page
- Optional randomized offsets for clock-in and clock-out times
- Optional break splitting that creates two entries around a scheduled break
- Progress tracking and cancellation while automation is running
- Persisted settings with `chrome.storage.sync`

The extension is injected on `app.hibob.com` and only activates its automation UI on the HiBob attendance route:

- `https://app.hibob.com/attendance/my-attendance`

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Chrome Extensions Manifest V3](https://developer.chrome.com/docs/extensions/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

This project builds a local unpacked Chrome extension from the `dist` directory.

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/Casm101/hibob-helper.git
   cd hibob-helper
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Build the extension
   ```sh
   npm run build
   ```
4. Open `chrome://extensions`
5. Enable `Developer mode`
6. Click `Load unpacked`
7. Select the generated `dist` directory

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

1. Open HiBob and navigate to `My Attendance`
2. Set your default clock-in and clock-out times in the popup
3. Optionally enable:
   - random time offsets
   - scheduled break splitting
4. Run automation from either:
   - the extension popup
   - the inline floating controls on the attendance page
5. Monitor progress and cancel if needed

Notes:

- Times and settings are stored with `chrome.storage.sync`
- The inline controls reflect the stored randomization and break toggles
- The automation targets flagged rows that need attendance entries completed

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [ ] Add dry-run or preview mode before saving
- [ ] Add row-level success, skip, and failure reporting
- [ ] Add automated tests for time logic and selector parsing
- [ ] Improve resilience against HiBob DOM and selector changes

See the [open issues](https://github.com/Casm101/hibob-helper/issues) for proposed improvements and bugs.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are welcome.

1. Fork the project
2. Create your feature branch
   ```sh
   git checkout -b feature/my-change
   ```
3. Commit your changes
   ```sh
   git commit -m "Add my change"
   ```
4. Push the branch
   ```sh
   git push origin feature/my-change
   ```
5. Open a pull request

If you are planning a larger change, open an issue first so the approach can be discussed before implementation.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


## Contact

Maintainer: [Casm101](https://github.com/Casm101)

Project Link: [https://github.com/Casm101/hibob-helper](https://github.com/Casm101/hibob-helper)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[stars-shield]: https://img.shields.io/github/stars/Casm101/hibob-helper.svg?style=for-the-badge
[stars-url]: https://github.com/Casm101/hibob-helper/stargazers
[forks-shield]: https://img.shields.io/github/forks/Casm101/hibob-helper.svg?style=for-the-badge
[forks-url]: https://github.com/Casm101/hibob-helper/network/members
[issues-shield]: https://img.shields.io/github/issues/Casm101/hibob-helper.svg?style=for-the-badge
[issues-url]: https://github.com/Casm101/hibob-helper/issues
