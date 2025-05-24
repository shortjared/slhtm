class TetrisPoetry {
    constructor() {
        this.grid = Array(20).fill().map(() => Array(10).fill(''));
        this.score = 0;
        this.streak = this.loadStreak();
        this.currentPiece = { 
            letters: ['', '', '', ''], 
            originalLetters: ['', '', '', ''],
            positions: [[0,0], [0,1], [1,0], [1,1]], // relative positions for 2x2 square
            x: 4, 
            y: 0,
            permutationIndex: 0
        };
        this.nextPieces = [
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', '']
        ];
        this.gameRunning = false;
        this.dropInterval = null;
        this.foundWords = [];
        this.dailyTheme = this.getDailyTheme();
        
        this.letterFrequency = {
            'E': 12, 'T': 9, 'A': 8, 'O': 8, 'I': 7, 'N': 7, 'S': 6, 'H': 6,
            'R': 6, 'D': 4, 'L': 4, 'C': 3, 'U': 3, 'M': 2, 'W': 2, 'F': 2,
            'G': 2, 'Y': 2, 'P': 2, 'B': 1, 'V': 1, 'K': 1, 'J': 1, 'X': 1,
            'Q': 1, 'Z': 1
        };
        
        this.scrabbleValues = {
            'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4,
            'I': 1, 'J': 8, 'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3,
            'Q': 10, 'R': 1, 'S': 1, 'T': 1, 'U': 1, 'V': 4, 'W': 4, 'X': 8,
            'Y': 4, 'Z': 10
        };
        
        this.dictionary = null;
        
        this.init();
    }
    
    async init() {
        await this.loadDictionary();
        this.createGrid();
        this.updateDisplay();
        this.generateNextPieces();
        this.spawnNewPiece();
        this.setupControls();
        this.startGame();
    }
    
    createGrid() {
        const gridElement = document.getElementById('game-grid');
        gridElement.innerHTML = '';
        
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 10; col++) {
                const cell = document.createElement('div');
                cell.className = 'grid-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                gridElement.appendChild(cell);
            }
        }
    }
    
    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('streak').textContent = this.streak;
        document.getElementById('theme').textContent = this.dailyTheme;
        
        // Update all 5 preview grids
        for (let pieceIndex = 0; pieceIndex < 5; pieceIndex++) {
            for (let i = 0; i < 4; i++) {
                document.getElementById(`preview-${pieceIndex}-${i}`).textContent = this.nextPieces[pieceIndex][i] || '';
            }
        }
        
        this.renderGrid();
    }
    
    renderGrid() {
        const cells = document.querySelectorAll('.grid-cell');
        
        cells.forEach(cell => {
            const row = parseInt(cell.dataset.row);
            const col = parseInt(cell.dataset.col);
            const letter = this.grid[row][col];
            
            cell.textContent = letter;
            cell.className = 'grid-cell';
            
            if (letter) {
                cell.classList.add('filled');
            }
        });
        
        // Render falling piece
        if (this.gameRunning) {
            this.currentPiece.positions.forEach((pos, index) => {
                const row = this.currentPiece.y + pos[0];
                const col = this.currentPiece.x + pos[1];
                
                if (row >= 0 && row < 20 && col >= 0 && col < 10) {
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) {
                        cell.classList.add('falling');
                        cell.textContent = this.currentPiece.letters[index];
                    }
                }
            });
        }
    }
    
    generateNextPieces() {
        const letters = Object.keys(this.letterFrequency);
        const weights = Object.values(this.letterFrequency);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        // Generate all 5 pieces
        for (let pieceIndex = 0; pieceIndex < 5; pieceIndex++) {
            for (let i = 0; i < 4; i++) {
                let random = Math.random() * totalWeight;
                
                for (let j = 0; j < letters.length; j++) {
                    random -= weights[j];
                    if (random <= 0) {
                        this.nextPieces[pieceIndex][i] = letters[j];
                        break;
                    }
                }
                
                if (!this.nextPieces[pieceIndex][i]) {
                    this.nextPieces[pieceIndex][i] = 'A';
                }
            }
        }
    }
    
    generateSinglePiece(pieceIndex) {
        const letters = Object.keys(this.letterFrequency);
        const weights = Object.values(this.letterFrequency);
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        
        for (let i = 0; i < 4; i++) {
            let random = Math.random() * totalWeight;
            
            for (let j = 0; j < letters.length; j++) {
                random -= weights[j];
                if (random <= 0) {
                    this.nextPieces[pieceIndex][i] = letters[j];
                    break;
                }
            }
            
            if (!this.nextPieces[pieceIndex][i]) {
                this.nextPieces[pieceIndex][i] = 'A';
            }
        }
    }
    
    spawnNewPiece() {
        this.currentPiece = {
            letters: [...this.nextPieces[0]],
            originalLetters: [...this.nextPieces[0]],
            positions: [[0,0], [0,1], [1,0], [1,1]],
            x: 4,
            y: 0,
            permutationIndex: 0
        };
        
        // Check if spawn position is blocked
        if (this.isPieceBlocked(this.currentPiece)) {
            this.gameOver();
            return;
        }
        
        // Shift pieces queue: move all pieces up and generate a new one at the end
        for (let i = 0; i < 4; i++) {
            this.nextPieces[i] = [...this.nextPieces[i + 1]];
        }
        this.generateSinglePiece(4); // Generate new piece at position 4
        
        this.updateDisplay();
    }
    
    startGame() {
        this.gameRunning = true;
        this.dropInterval = setInterval(() => {
            this.dropPiece();
        }, 1000);
    }
    
    dropPiece() {
        if (!this.gameRunning) return;
        
        if (this.canPieceMoveTo(this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
        } else {
            this.placePiece();
            this.checkForWords();
            this.spawnNewPiece();
        }
        
        this.updateDisplay();
    }
    
    isPieceBlocked(piece) {
        return piece.positions.some(pos => {
            const row = piece.y + pos[0];
            const col = piece.x + pos[1];
            return row < 0 || row >= 20 || col < 0 || col >= 10 || this.grid[row][col] !== '';
        });
    }
    
    canPieceMoveTo(newX, newY) {
        const testPiece = { ...this.currentPiece, x: newX, y: newY };
        return !this.isPieceBlocked(testPiece);
    }
    
    placePiece() {
        // First, place all letters at their current positions
        this.currentPiece.positions.forEach((pos, index) => {
            const col = this.currentPiece.x + pos[1];
            const row = this.currentPiece.y + pos[0];
            
            // Place the letter if within bounds
            if (row >= 0 && row < 20 && col >= 0 && col < 10) {
                this.grid[row][col] = this.currentPiece.letters[index];
            }
        });
        
        // Then drop all floating tiles down (including the ones we just placed)
        this.dropFloatingTiles();
    }
    
    movePiece(direction) {
        if (!this.gameRunning) return;
        
        const newX = this.currentPiece.x + direction;
        if (this.canPieceMoveTo(newX, this.currentPiece.y)) {
            this.currentPiece.x = newX;
            this.updateDisplay();
        }
    }
    
    rotatePiece(direction = 1) {
        if (!this.gameRunning) return;
        
        // Cycle through letter permutations instead of rotating shape
        this.currentPiece.permutationIndex = (this.currentPiece.permutationIndex + direction + 24) % 24; // 4! = 24 permutations
        
        // Use the original letters from when the piece was spawned
        this.currentPiece.letters = this.getPermutation(this.currentPiece.originalLetters, this.currentPiece.permutationIndex);
        this.updateDisplay();
    }
    
    getPermutation(letters, index) {
        // Generate the nth permutation of 4 letters
        const arr = [...letters];
        const result = [];
        const factorial = [1, 1, 2, 6]; // factorials for 0!, 1!, 2!, 3!
        
        for (let i = 4; i > 0; i--) {
            const fact = factorial[i - 1];
            const quotient = Math.floor(index / fact);
            index = index % fact;
            result.push(arr.splice(quotient, 1)[0]);
        }
        
        return result;
    }
    
    checkForWords() {
        const foundWords = [];
        const processedWords = new Set();
        const directions = [
            [0, 1],   // horizontal right
            [0, -1],  // horizontal left
            [1, 0],   // vertical down
            [-1, 0],  // vertical up
            [1, 1],   // diagonal down-right
            [1, -1],  // diagonal down-left
            [-1, 1],  // diagonal up-right
            [-1, -1]  // diagonal up-left
        ];
        
        for (let row = 0; row < 20; row++) {
            for (let col = 0; col < 10; col++) {
                if (this.grid[row][col] === '') continue;
                
                for (const [dx, dy] of directions) {
                    const word = this.getWordFromPosition(row, col, dx, dy);
                    if (word.word.length >= 4 && this.isValidWord(word.word)) {
                        const wordKey = word.positions.map(pos => `${pos[0]}-${pos[1]}`).sort().join('|');
                        if (!processedWords.has(wordKey)) {
                            processedWords.add(wordKey);
                            foundWords.push(word);
                        }
                    }
                }
            }
        }
        
        if (foundWords.length > 0) {
            this.processFoundWords(foundWords);
        }
    }
    
    getWordFromPosition(startRow, startCol, dx, dy) {
        let word = '';
        let positions = [];
        let row = startRow;
        let col = startCol;
        
        while (row >= 0 && row < 20 && col >= 0 && col < 10 && this.grid[row][col] !== '') {
            word += this.grid[row][col];
            positions.push([row, col]);
            row += dx;
            col += dy;
        }
        
        return { word, positions };
    }
    
    async loadDictionary() {
        try {
            const response = await fetch('./dict.json');
            this.dictionary = await response.json();
        } catch (error) {
            console.error('Failed to load dictionary:', error);
            this.dictionary = {};
        }
    }
    
    isValidWord(word) {
        return word.length >= 4 && this.dictionary && this.dictionary.hasOwnProperty(word.toLowerCase());
    }
    
    processFoundWords(words) {
        let totalScore = 0;
        const processedPositions = new Set();
        
        words.forEach(wordObj => {
            const posKey = wordObj.positions.map(pos => `${pos[0]}-${pos[1]}`).join(',');
            if (!processedPositions.has(posKey)) {
                processedPositions.add(posKey);
                
                const points = this.calculateWordScore(wordObj.word);
                totalScore += points;
                
                this.foundWords.push({ word: wordObj.word, points });
                this.highlightWord(wordObj.positions);
                this.removeWordFromGrid(wordObj.positions);
            }
        });
        
        this.score += totalScore;
        this.updateWordsList();
        this.updateDisplay();
        
        setTimeout(() => {
            this.dropFloatingTiles();
        }, 1000);
    }
    
    calculateWordScore(word) {
        let letterSum = 0;
        
        // Calculate sum of Scrabble letter values
        for (let letter of word.toUpperCase()) {
            letterSum += this.scrabbleValues[letter] || 0;
        }
        
        // Multiply by word length
        return letterSum * word.length;
    }
    
    highlightWord(positions) {
        positions.forEach(([row, col]) => {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('word-highlight');
                setTimeout(() => {
                    cell.classList.remove('word-highlight');
                }, 1000);
            }
        });
    }
    
    removeWordFromGrid(positions) {
        positions.forEach(([row, col]) => {
            this.grid[row][col] = '';
        });
    }
    
    dropFloatingTiles() {
        for (let col = 0; col < 10; col++) {
            let writePos = 19;
            for (let row = 19; row >= 0; row--) {
                if (this.grid[row][col] !== '') {
                    if (writePos !== row) {
                        this.grid[writePos][col] = this.grid[row][col];
                        this.grid[row][col] = '';
                    }
                    writePos--;
                }
            }
        }
        this.updateDisplay();
    }
    
    updateWordsList() {
        const wordsList = document.getElementById('words-list');
        wordsList.innerHTML = '';
        
        this.foundWords.slice(-10).reverse().forEach(wordData => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${wordData.word}</span><span>+${wordData.points}</span>`;
            wordsList.appendChild(li);
        });
    }
    
    setupControls() {
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.movePiece(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.movePiece(1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.rotatePiece(-1); // Rotate backwards
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.rotatePiece(1); // Rotate forwards
                    break;
                case ' ':
                    e.preventDefault();
                    this.hardDrop();
                    break;
            }
        });
        
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.togglePause();
        });
        
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.newGame();
        });
        
        let touchStartX = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
        });
        
        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchStartX - touchEndX;
            const diffY = touchStartY - touchEndY;
            
            if (Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    this.movePiece(-1);
                } else {
                    this.movePiece(1);
                }
            } else if (Math.abs(diffY) > 50) {
                if (diffY > 0) {
                    this.rotatePiece();
                } else {
                    this.dropPiece();
                }
            } else {
                this.dropPiece();
            }
        });
        
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });
    }
    
    hardDrop() {
        while (this.canPieceMoveTo(this.currentPiece.x, this.currentPiece.y + 1)) {
            this.currentPiece.y++;
        }
        this.placePiece();
        this.checkForWords();
        this.spawnNewPiece();
        this.updateDisplay();
    }
    
    togglePause() {
        if (this.gameRunning) {
            this.gameRunning = false;
            clearInterval(this.dropInterval);
            document.getElementById('pause-btn').textContent = 'Resume';
        } else {
            this.gameRunning = true;
            this.dropInterval = setInterval(() => {
                this.dropPiece();
            }, 1000);
            document.getElementById('pause-btn').textContent = 'Pause';
        }
    }
    
    newGame() {
        this.grid = Array(20).fill().map(() => Array(10).fill(''));
        this.score = 0;
        this.foundWords = [];
        this.gameRunning = false;
        clearInterval(this.dropInterval);
        
        this.createGrid();
        this.updateDisplay();
        this.updateWordsList();
        this.generateNextPieces();
        this.spawnNewPiece();
        this.startGame();
        
        document.getElementById('pause-btn').textContent = 'Pause';
    }
    
    gameOver() {
        this.gameRunning = false;
        clearInterval(this.dropInterval);
        
        if (this.foundWords.length > 0) {
            this.streak++;
            this.saveStreak();
        }
        
        alert(`Game Over! Final Score: ${this.score}\nWords Found: ${this.foundWords.length}\nStreak: ${this.streak}`);
    }
    
    getDailyTheme() {
        const themes = ['Animals', 'Colors', 'Food', 'Nature', 'Space', 'Music', 'Sports'];
        const today = new Date().toDateString();
        const hash = this.hashCode(today);
        return themes[Math.abs(hash) % themes.length];
    }
    
    hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }
    
    loadStreak() {
        const saved = localStorage.getItem('slhtm-streak');
        const lastPlayed = localStorage.getItem('slhtm-last-played');
        const today = new Date().toDateString();
        
        if (lastPlayed === today) {
            return parseInt(saved) || 0;
        } else if (this.isConsecutiveDay(lastPlayed, today)) {
            return parseInt(saved) || 0;
        } else {
            return 0;
        }
    }
    
    saveStreak() {
        const today = new Date().toDateString();
        localStorage.setItem('slhtm-streak', this.streak.toString());
        localStorage.setItem('slhtm-last-played', today);
    }
    
    isConsecutiveDay(lastPlayed, today) {
        if (!lastPlayed) return false;
        
        const last = new Date(lastPlayed);
        const current = new Date(today);
        const diffTime = current - last;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays === 1;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    new TetrisPoetry();
});