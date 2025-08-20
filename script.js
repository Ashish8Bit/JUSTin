document.addEventListener('DOMContentLoaded', () => {
    const { jsPDF } = window.jspdf;
    const { pdfjsLib } = window;

    // --- Tab-switching Logic ---
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');

            const target = document.querySelector(`#${tab.dataset.tab}`);
            tabContents.forEach(content => content.classList.remove('active'));
            target.classList.add('active');
        });
    });

    // --- UI Helpers ---
    const toastContainer = document.getElementById('toast-container');

    /**
     * Displays a toast notification.
     * @param {string} message The message to display.
     * @param {'success' | 'error'} type The type of toast.
     * @param {number} duration The duration in ms to show the toast.
     */
    function showToast(message, type = 'success', duration = 4000) {
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        toastContainer.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    /**
     * Displays a loading spinner in a given element.
     * @param {HTMLElement} element The container element for the loader.
     */
    function showLoader(element) {
        if (!element) return;
        element.innerHTML = `
            <div class="loader-container">
                <div class="loader"></div>
            </div>
        `;
    }

    // --- Generic File Handling ---
    const fileInputs = new Map();

    function setupFileUpload(inputId) {
        const inputElement = document.getElementById(inputId);
        const dropArea = inputElement.closest('.file-upload-wrapper').querySelector('.file-drop-area');
        const fileListWrapper = document.getElementById(`${inputId}FileListContainer`);
        const fileListContainer = document.getElementById(`${inputId}-fileList`);
        const clearBtn = fileListWrapper.querySelector('.clear-btn');
        const outputArea = document.getElementById(inputId.replace('Input', 'Output'));

        fileInputs.set(inputId, []);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
        });

        dropArea.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);
        inputElement.addEventListener('change', (e) => handleFiles(e.target.files), false);

        function handleFiles(files) {
            const fileList = Array.from(files);
            if (inputElement.multiple) {
                fileInputs.set(inputId, [...fileInputs.get(inputId), ...fileList]);
            } else {
                fileInputs.set(inputId, fileList);
            }
            renderFileList();
        }

        clearBtn.addEventListener('click', () => {
            fileInputs.set(inputId, []); // Clear the files array
            if (outputArea) {
                outputArea.innerHTML = ''; // Clear any previous conversion results
            }
            renderFileList(); // Re-render to update UI
        });

        function renderFileList() {
            const currentFiles = fileInputs.get(inputId);
            const buttonId = inputId.replace('Input', 'Btn');
            const button = document.getElementById(buttonId);

            if (button) {
                button.disabled = currentFiles.length === 0;
            }

            if (fileListWrapper) {
                fileListWrapper.style.display = currentFiles.length > 0 ? 'block' : 'none';
            }

            fileListContainer.innerHTML = ''; // Clear previous list

            if (currentFiles.length === 0) {
                return;
            }

            currentFiles.forEach(file => {
                const fileElement = document.createElement('div');
                fileElement.className = 'file-list-item';

                const isImage = file.type.startsWith('image/');
                const isPdf = file.type === 'application/pdf';

                let thumbnailHtml = '';
                if (isImage) {
                    thumbnailHtml = `<img src="${URL.createObjectURL(file)}" alt="${escapeHtml(file.name)}" class="file-thumbnail">`;
                } else if (isPdf) {
                    thumbnailHtml = `<div class="file-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f0f0f0" width="32px" height="32px"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm-6.5-2.5h1.5v1.5H9v-1.5zm5 0h1.5v1.5H14v-1.5z"/></svg></div>`;
                } else {
                    thumbnailHtml = `<div class="file-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f0f0f0" width="32px" height="32px"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg></div>`;
                }

                fileElement.innerHTML = `
                    ${thumbnailHtml}
                    <span class="file-name">${escapeHtml(file.name)}</span>
                `;
                fileListContainer.appendChild(fileElement);
            });
        }
    }

    setupFileUpload('imageToPdfInput');
    setupFileUpload('removeBgInput');
    setupFileUpload('pdfToImageInput');

    // --- Conversion Logic ---

    function setButtonState(button, text, disabled) {
        button.textContent = text;
        button.disabled = disabled;
    }

    // 1. Image to PDF
    const imageToPdfBtn = document.getElementById('imageToPdfBtn');
    const imageToPdfOutput = document.getElementById('imageToPdfOutput');

    imageToPdfBtn.addEventListener('click', async () => {
        const files = fileInputs.get('imageToPdfInput');
        if (files.length === 0) {
            showToast('Please select at least one image.', 'error');
            return;
        }

        setButtonState(imageToPdfBtn, 'Converting...', true);
        showLoader(imageToPdfOutput);

        try {
            const pdf = new jsPDF();
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const imageData = await readFileAsDataURL(file);
                const img = await loadImage(imageData);

                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const imgRatio = img.width / img.height;
                const pageRatio = pageWidth / pageHeight;

                let imgWidth, imgHeight;
                if (imgRatio > pageRatio) {
                    imgWidth = pageWidth;
                    imgHeight = pageWidth / imgRatio;
                } else {
                    imgHeight = pageHeight;
                    imgWidth = pageHeight * imgRatio;
                }

                if (i > 0) pdf.addPage();
                pdf.addImage(imageData, 'JPEG', 0, 0, imgWidth, imgHeight);
            }

            const pdfBlob = pdf.output('blob');
            const url = URL.createObjectURL(pdfBlob);
            imageToPdfOutput.innerHTML = `<a href="${url}" download="converted.pdf">Download PDF</a>`;
            showToast('PDF created successfully!');

        } catch (error) {
            console.error('Error converting to PDF:', error);
            imageToPdfOutput.innerHTML = 'An error occurred during conversion.';
            showToast('An error occurred during PDF conversion.', 'error');
        } finally {
            setButtonState(imageToPdfBtn, 'Convert to PDF', false);
        }
    });

    // 2. Remove Background
    const removeBgBtn = document.getElementById('removeBgBtn');
    const removeBgOutput = document.getElementById('removeBgOutput');

    removeBgBtn.addEventListener('click', async () => {
        const files = fileInputs.get('removeBgInput');
        if (files.length === 0) {
            showToast('Please select an image.', 'error');
            return;
        }

        setButtonState(removeBgBtn, 'Processing...', true);
        showLoader(removeBgOutput);

        try {
            const file = files[0];
            // The removeBackground function is on the window.imgly object
            const imageBlob = await window.imgly.removeBackground(file, {
                // Explicitly set the public path to the CDN location of the assets
                publicPath: 'https://unpkg.com/@imgly/background-removal/dist/',
                onProgress: (progress) => {
                    const percentage = Math.round(progress.progress * 100);
                    setButtonState(removeBgBtn, `Processing... ${percentage}%`, true);
                }
            });

            const url = URL.createObjectURL(imageBlob);
            const originalFileName = file.name.substring(0, file.name.lastIndexOf('.') || file.name.length);

            removeBgOutput.innerHTML = `
                <div class="output-preview-container">
                    <img src="${url}" alt="Image with background removed" class="output-preview-image">
                </div>
                <a href="${url}" download="${originalFileName}-no-bg.png">Download PNG</a>
            `;
            showToast('Background removed successfully!');

        } catch (error) {
            console.error('Error removing background:', error);
            removeBgOutput.innerHTML = 'An error occurred. The image format might not be supported.';
            showToast('Failed to remove background.', 'error');
        } finally {
            setButtonState(removeBgBtn, 'Remove Background', false);
        }
    });

    // 3. PDF to Image
    const pdfToImageBtn = document.getElementById('pdfToImageBtn');
    const pdfToImageOutput = document.getElementById('pdfToImageOutput');

    pdfToImageBtn.addEventListener('click', async () => {
        const files = fileInputs.get('pdfToImageInput');
        if (files.length === 0) {
            showToast('Please select a PDF file.', 'error');
            return;
        }

        setButtonState(pdfToImageBtn, 'Converting...', true);
        showLoader(pdfToImageOutput);

        try {
            const file = files[0];
            const data = await readFileAsArrayBuffer(file);
            const pdf = await pdfjsLib.getDocument({ data }).promise;
            const numPages = pdf.numPages;
            pdfToImageOutput.innerHTML = '';

            for (let i = 1; i <= numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const imgData = canvas.toDataURL('image/png');
                const img = document.createElement('img');
                img.src = imgData;

                const link = document.createElement('a');
                link.href = imgData;
                link.download = `page_${i}.png`;
                link.appendChild(img);

                pdfToImageOutput.appendChild(link);
            }

            showToast(`Converted ${numPages} page(s) successfully!`);

        } catch (error) {
            console.error('Error converting PDF to images:', error);
            pdfToImageOutput.innerHTML = 'An error occurred during conversion. The PDF might be corrupted or protected.';
            showToast('Error converting PDF. It may be corrupted or protected.', 'error');
        } finally {
            setButtonState(pdfToImageBtn, 'Convert to Images', false);
        }
    });


    // --- Helper Functions ---
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // --- Feature Availability Check ---
    function checkFeatureAvailability() {
        // Check for Background Removal library
        if (typeof window.imgly?.removeBackground !== 'function') {
            console.warn('Background removal library (imgly) not found.');
            const removeBgNavBtn = document.getElementById('remove-bg-nav-btn');
            const removeBgTabContent = document.getElementById('remove-bg-tab');

            if (removeBgNavBtn) {
                removeBgNavBtn.classList.add('disabled');
                // The click listener for tabs will ignore disabled buttons, but we can be extra safe
                removeBgNavBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                }, true);
            }

            if (removeBgTabContent) {
                removeBgTabContent.innerHTML = `
                    <div class="feature-unavailable">
                        <h2>Feature Unavailable</h2>
                        <p>The background removal library failed to load. This can be caused by ad-blockers, privacy extensions, or network issues. Please check your browser extensions and connection, then refresh the page.</p>
                    </div>`;
            }
        }
    }
    window.addEventListener('load', checkFeatureAvailability);
});