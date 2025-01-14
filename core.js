const orphanMap = {}

const resolved = Promise.resolve()

const orphanResolveQueue = {
  contexts: new Set(),
  running: false,
  add(context) {
    this.contexts.add(context)
    if (!this.running) {
      this.running = true
      resolved.then(() => {
        this.contexts.forEach((context) => {
          const orphans = orphanMap[context]
          orphans.forEach(({ setter, payload }, orphan) => {
            const event = sendContextEvent(orphan, context, payload, setter)
            const provider = event.detail.provider
            if (provider) {
              orphans.delete(orphan)
              registerProvider(orphan, context, provider)
            }
          })
        })
        this.contexts.clear()
        this.running = false
      })
    }
  },
}

function addOrphan(el, name, payload, setter) {
  const orphans = orphanMap[name] || (orphanMap[name] = new Map())
  orphans.set(el, { setter, payload })
}

function removeOrphan(el, name) {
  const orphans = orphanMap[name]
  if (orphans) {
    orphans.delete(el)
  }
}

function sendContextEvent(consumer, context, payload, setter) {
  const event = new CustomEvent(`context-request-${context}`, {
    detail: { setter, payload, consumer },
    bubbles: true,
    cancelable: true,
    composed: true,
  })
  consumer.dispatchEvent(event)
  return event
}

let contextCount = 0

function createContext(name) {
  return {
    id: `${name}${++contextCount}`,
    name,
    toString() {
      return this.id
    },
  }
}

function getProviderValue(provider, { getter, payload }) {
  return getter(provider, payload)
}

function providerGetter(provider, payload) {
  return payload
}

function registerContext(provider, context, payload, getter = providerGetter) {
  const observerMap =
    provider.__wcContextObserverMap || (provider.__wcContextObserverMap = {})
  const providedContexts =
    provider.__wcContextProvided || (provider.__wcContextProvided = {})
  providedContexts[context] = { getter, payload }
  const observers = observerMap[context] || (observerMap[context] = [])
  const orphans = orphanMap[context]
  provider.addEventListener(`context-request-${context}`, (event) => {
    event.stopPropagation()
    const value = getProviderValue(provider, providedContexts[context])
    const { setter, payload, consumer } = event.detail
    setter(consumer, value, payload)
    observers.push({ consumer, setter, payload })
    runListeners(provider, context, 'observe', observers.length)
    event.detail.provider = provider
  })
  if (orphans && orphans.size) {
    orphanResolveQueue.add(context)
  }
}

function getProvidedContext(provider, context, caller) {
  const providedContexts = provider.__wcContextProvided
  const providedContext = providedContexts && providedContexts[context]

  if (!providedContext) {
    throw new Error(`${caller}: "${context.name || context}" is not registered`)
  }

  return providedContext
}

function updateContext(provider, context, payload) {
  const observerMap = provider.__wcContextObserverMap
  const providedContext = getProvidedContext(provider, context, 'updateContext')

  if (payload !== undefined) {
    providedContext.payload = payload
  }

  const value = getProviderValue(provider, providedContext)

  const observers = observerMap && observerMap[context]
  if (observers) {
    observers.forEach(({ consumer, setter, payload }) => {
      setter(consumer, value, payload)
    })
  }
}
function consumerSetter(consumer, value, name) {
  const oldValue = consumer[name]
  if (oldValue !== value) {
    consumer[name] = value
    if (typeof consumer.contextChangedCallback === 'function') {
      consumer.contextChangedCallback(name, oldValue, value)
    }
  }
}

function runListeners(provider, context, type, count) {
  const providedContext = getProvidedContext(provider, context, 'runListeners')

  const listeners = providedContext.listeners
  if (listeners) {
    for (const listener of listeners) {
      if (listener.type === type) {
        listener.callback.call(provider, { count })
      }
    }
  }
}

function registerProvider(consumer, context, provider) {
  const providerMap =
    consumer.__wcContextProviderMap || (consumer.__wcContextProviderMap = {})
  providerMap[context] = provider
}

function observeContext(
  consumer,
  context,
  payload = context,
  setter = consumerSetter
) {
  const event = sendContextEvent(consumer, context, payload, setter)
  const provider = event.detail.provider
  if (provider) {
    registerProvider(consumer, context, provider)
  } else {
    addOrphan(consumer, context, payload, setter)
  }
}

function removeObserver(provider, context, consumer) {
  if (provider) {
    const observerMap = provider.__wcContextObserverMap
    if (observerMap) {
      const observers = observerMap[context]
      const consumerIndex = observers.findIndex(
        (observer) => observer.consumer === consumer
      )
      if (consumerIndex !== -1) {
        observers.splice(consumerIndex, 1)
      }
      runListeners(provider, context, 'unobserve', observers.length)
    }
  }
}

function unobserveContext(consumer, context) {
  const providerMap = consumer.__wcContextProviderMap
  if (providerMap) {
    removeObserver(providerMap[context], context, consumer)
  }

  removeOrphan(consumer, context)
}

function onContextObserve(provider, context, callback) {
  const providedContext = getProvidedContext(
    provider,
    context,
    'onContextObserve'
  )
  const listeners =
    providedContext.listeners || (providedContext.listeners = [])
  listeners.push({ callback, type: 'observe' })
}

function onContextUnobserve(provider, context, callback) {
  const providedContext = getProvidedContext(
    provider,
    context,
    'onContextUnobserve'
  )

  const listeners =
    providedContext.listeners || (providedContext.listeners = [])
  listeners.push({ callback, type: 'unobserve' })
}

export {
  createContext,
  registerContext,
  updateContext,
  observeContext,
  unobserveContext,
  consumerSetter,
  providerGetter,
  onContextObserve,
  onContextUnobserve,
}
