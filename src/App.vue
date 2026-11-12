<template>
  <div class="container">
    <div class="dark-mode-toggle" @click="toggleDark">
      <span>{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM7 8a4 4 0 100 8 4 4 0 000-8z" clip-rule="evenodd" />
      </svg>
    </div>

    <div class="file-upload" @dragover="onDragOver" @drop="onDrop">
      <p>Drag and drop your resume (.tex) file here</p>
      <p>or</p>
      <input type="file" accept=".tex" @change="onFileSelect" />
    </div>

    <div v-if="selectedFile" class="card">
      <h2>Resume Preview</h2>
      <pre>{{ selectedFile.content }}</pre>
    </div>

    <div v-if="analysisResult" class="card">
      <h2>Analysis Results</h2>
      <p>ATS Compatibility Score: {{ analysisResult.atsScore }}%</p>
      <p>Recommendations: {{ analysisResult.recommendations.join(', ') }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      isDark: false,
      selectedFile: null,
      analysisResult: null
    }
  },
  methods: {
    toggleDark() {
      this.isDark = !this.isDark
      document.documentElement.classList.toggle('dark', this.isDark)
    },
    onFileSelect(event) {
      const file = event.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          this.selectedFile = {
            name: file.name,
            content: e.target.result
          }
        }
        reader.readAsText(file)
      }
    },
    onDrop(event) {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          this.selectedFile = {
            name: file.name,
            content: e.target.result
          }
        }
        reader.readAsText(file)
      }
    },
    onDragOver(event) {
      event.preventDefault()
    }
  }
}
</script>

<style scoped>
.file-upload {
  border: 2px dashed var(--border);
  border-radius: 0.5rem;
  padding: 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-upload:hover {
  border-color: var(--ring);
  background-color: var(--input);
}

pre {
  white-space: pre-wrap;
  background-color: var(--card);
  padding: 1rem;
  border-radius: 0.5rem;
  margin-top: 1rem;
}
</style>