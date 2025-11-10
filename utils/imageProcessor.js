// Image processing utilities (for browser)
class ImageProcessor {
    static async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
        });
    }
    
    static createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    
    static grayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
            data[i] = avg;     // red
            data[i + 1] = avg; // green
            data[i + 2] = avg; // blue
        }
        return imageData;
    }
    
    static invert(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = 255 - data[i];     // red
            data[i + 1] = 255 - data[i + 1]; // green
            data[i + 2] = 255 - data[i + 2]; // blue
        }
        return imageData;
    }
    
    static resize(img, maxWidth, maxHeight) {
        const canvas = this.createCanvas(maxWidth, maxHeight);
        const ctx = canvas.getContext('2d');
        
        // Calculate new dimensions maintaining aspect ratio
        let { width, height } = img;
        if (width > height) {
            if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
            }
        } else {
            if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        return canvas;
    }
    
    static getImageData(canvas) {
        const ctx = canvas.getContext('2d');
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
    
    static putImageData(canvas, imageData) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }
}

module.exports = ImageProcessor;

