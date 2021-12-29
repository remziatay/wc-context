import { html } from 'lit'
import { styles } from './styles.js'
import { Component } from './component.js'

class ThemeProvider extends Component {
  static get properties() {
    return {
      theme: { type: String },
      alttheme: { type: String },
      activeTheme: { type: String, providedContext: 'theme' },
    }
  }

  toggleTheme() {
    const primaryTheme = this.theme || 'light'
    const altTheme = this.alttheme || 'dark'
    this.activeTheme =
      this.activeTheme === primaryTheme ? altTheme : primaryTheme
  }

  connectedCallback() {
    super.connectedCallback()
    this.activeTheme = this.theme || 'light'
  }

  render() {
    return html`
      <button @click=${this.toggleTheme}>toggle theme</button>
      <slot></slot>
    `
  }
}

class ThemeConsumer extends Component {
  static properties = {
    theme: { type: String, context: 'theme' },
  }

  contextChangedCallback(name, oldValue, value) {
    console.log(
      this.constructor.name,
      `context "${name}" changed from "${oldValue}" to "${value}"`
    )
  }

  render() {
    return html`<div style=${styles[this.theme]}>${this.theme}</div>`
  }
}

class TitleProvider extends Component {
  static get properties() {
    return {
      value: { type: String, providedContext: 'title' },
    }
  }

  render() {
    return html`<slot></slot>`
  }
}

class TitleThemeConsumer extends Component {
  static properties = {
    title: { context: 'title' },
    theme: { context: 'theme' },
  }

  contextChangedCallback(name, oldValue, value) {
    console.log(
      this.constructor.name,
      `context "${name}" changed from "${oldValue}" to "${value}"`
    )
  }

  render() {
    return html`
      <div>${this.title}</div>
      <div style=${styles[this.theme]}>${this.theme}</div>
    `
  }
}

class App extends Component {
  static get properties() {
    return {
      state: { type: Object },
    }
  }
  constructor() {
    super()
    this.state = { title: 'one title' }
    this.toggleTitle = () => {
      this.state = {
        ...this.state,
        ...{
          title:
            this.state.title === 'one title' ? 'another title' : 'one title',
        },
      }
    }
  }

  render() {
    return html`
      <div>
        <theme-provider>
          <theme-consumer></theme-consumer>
        </theme-provider>
        <theme-provider>
          <theme-provider theme="blue" alttheme="yellow">
            <theme-consumer></theme-consumer>
          </theme-provider>
        </theme-provider>
        <theme-provider>
          <title-provider value=${this.state.title}>
            <titletheme-consumer></titletheme-consumer>
          </title-provider>
        </theme-provider>
        <button @click=${this.toggleTitle}>Toggle title</button>
      </div>
    `
  }
}

customElements.define('theme-provider', ThemeProvider)
customElements.define('theme-consumer', ThemeConsumer)
customElements.define('title-provider', TitleProvider)
customElements.define('titletheme-consumer', TitleThemeConsumer)
customElements.define('context-example', App)

const appEl = document.createElement('context-example')

document.body.appendChild(appEl)