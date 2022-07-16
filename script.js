/*
* Original code by Cocahh
* This is a refactor by me, Plaabo twitch.tv/plaabo
*/
const CONTAINER_SELECTOR = '.messages-content'
const FIXED_TEST_MESSAGE_CLASS = 'fixed-test-message'
const KEEP_A_TEST_MESSAGE = {
  YES: 'yes',
  NO: 'no',
}
const EVENTS = {
  ON_WIDGET_LOAD: 'onWidgetLoad',
  ON_EVENT_RECEIVED: 'onEventReceived',
}
const LISTENERS = {
  DELETE_MESSAGE: 'delete-message',
  DELETE_MESSAGES: 'delete-messages',
  MESSAGE: 'message',
}
const ADDITIONS = {
  APPEND: 'append',
  PREPEND: 'prepend',
}
const HIDE_COMMANDS = {
  YES: 'yes',
  NO: 'no',
}
const ALIGN_MESSAGES = {
  TOP: 'column-reverse',
  BOTTOM: 'column',
}
const USER_NAME_COLOR_TYPE = {
  TWITCH: 'twitch',
  CUSTOM: 'custom',
}

let totalMessages = 0
let removeSelector = null
let addition = ADDITIONS.PREPEND
let channelName = null
let provider = null
let ignoredUsers = []
let testMessagesIntervalId = null
let shouldHideMessagesAfterDelay = true

// params from streamelements fields
let messageContainerAnimationIn = 'bounceIn'
let messageContainerAnimationOut = 'bounceOut'
let hideAfter = 10
let messagesLimit = 10
let userNameColorType = USER_NAME_COLOR_TYPE.TWITCH
let userNameCustomColor = null
let hideCommands = HIDE_COMMANDS.NO
let messagesInterval = 1.5

function deleteMessage(messageId) {
  $(`.message-row[data-msgid=${messageId}]`).remove();
}

function deleteUserMessages(userId) {
  $(`.message-row[data-sender=${userId}]`).remove();
}

function isCommand(text) {
  return text.startsWith('!')
}

function getBadgesHtmlString(badges) {
  const badgeHtmlStrings = badges.map(badge => {
    return `<img alt="" src="${badge.url}" class="badge"> `
  })
  
  return badgeHtmlStrings.join('')
}

function getUsernameHtmlString(displayName, displayColor = '') {
  let username = displayName + ':'
  let color = ''

  switch (userNameColorType) {
    case USER_NAME_COLOR_TYPE.TWITCH:
      const hasDisplayColor = displayColor !== ''
      color = hasDisplayColor ? displayColor : `#${(md5(username).substr(26))}`
      break
    case USER_NAME_COLOR_TYPE.CUSTOM:
      color = userNameCustomColor
      break
  }
  
  return `<span style="color:${color}">${username}</span>`
}

function handleUserMessage(eventData) {
  const {
    text,
    nick,
    badges,
    displayName,
    displayColor,
    userId,
    msgId,
  } = eventData
  const shouldHideCommands = isCommand(text) && hideCommands === HIDE_COMMANDS.YES
  const shouldIgnoreUser = ignoredUsers.indexOf(nick) !== -1
  
  if (shouldHideCommands || shouldIgnoreUser) {
    return
  }
  
  const badgesHtmlString = getBadgesHtmlString(badges)
  
  const usernameHtmlString = getUsernameHtmlString(displayName, displayColor)
  
  const message = attachEmotes(eventData)
  
  addMessage(
    usernameHtmlString,
    badgesHtmlString,
    message,
    userId,
    msgId
  )
}

window.addEventListener(EVENTS.ON_EVENT_RECEIVED, function ({ detail }) {
  const { event, listener } = detail
  
  const isWidgetButton = event.listener === 'widget-button'
  
  if (isWidgetButton) {
    const TEST_MESSAGE = 'testMessage'
    const START_SENDING_MESSAGES = 'startSendingMessages'
    const STOP_SENDING_MESSAGES = 'stopSendingMessages'
    
    switch (event.field) {
      case TEST_MESSAGE:
        testMessage()
        break
      case START_SENDING_MESSAGES:
        testMessage()
        startSendingMessages()
        break
      case STOP_SENDING_MESSAGES:
        stopSendingMessages()
        break
    }
  }
  
  switch (listener) {
    case LISTENERS.DELETE_MESSAGE:
      deleteMessage(event.msgId)
      break
    case LISTENERS.DELETE_MESSAGES:
      deleteUserMessages(event.userId)
      break
    case LISTENERS.MESSAGE:
      handleUserMessage(event.data)
      break
  }
})

window.addEventListener(EVENTS.ON_WIDGET_LOAD, function (obj) {
  const fieldData = obj.detail.fieldData
  messageContainerAnimationIn = fieldData.messageContainerAnimationIn
  messageContainerAnimationOut = fieldData.messageContainerAnimationOut
  hideAfter = fieldData.hideAfter
  messagesLimit = fieldData.messagesLimit
  nickColorType = fieldData.nickColor
  customNickColor = fieldData.customNickColor
  hideCommands = fieldData.hideCommands
  channelName = obj.detail.channel.username
  messagesInterval = fieldData.messagesInterval
  userNameColorType = fieldData.userNameColorType
  userNameCustomColor = fieldData.userNameCustomColor
  
  shouldHideMessagesAfterDelay = hideAfter !== 999

  if (fieldData.fixedTestMessage === true) {
    addFixedTestMessage()
  }
  
  fetch('https://api.streamelements.com/kappa/v2/channels/' + obj.detail.channel.id + '/')
  .then(response => response.json())
  .then((profile) => {
    provider = profile.provider
  })

  const mainContainer = $('.main-container')
  const messagesContent = $('.messages-content')
  
  if (fieldData.alignMessages === ALIGN_MESSAGES.TOP) {
    addition = ADDITIONS.PREPEND
    removeSelector = ".message-row:nth-child(n+" + messagesLimit + ")"
    mainContainer.addClass('main-container--bottom')
    messagesContent.addClass('messages-content--top')
  } else {
    addition = ADDITIONS.APPEND
    removeSelector = ".message-row:nth-last-child(n+" + messagesLimit + ")"
    mainContainer.addClass('main-container--top')
    messagesContent.addClass('messages-content--bottom')
  }
  
  ignoredUsers = fieldData.ignoredUsers.toLowerCase().replace(" ", "").split(",")
});

function attachEmotes(message) {
  const { text, emotes } = message
  const encodedText = html_encode(text)
  
  const words = encodedText.split(' ')
  
  const wordsAndEmote = words.reduce((emoteUrlStrings, word) => {
    const emote = emotes.find(emote => emote.name === word)
    
    if (!!emote) {
      const emoteUrl = emote.urls[1]
      const emoteHtmlString = `<img class="emote" " src="${emoteUrl}"/>`
      return [...emoteUrlStrings, emoteHtmlString]
    }
    
    return [...emoteUrlStrings, word]
  }, [])
  
  return wordsAndEmote.join(' ')
}

function html_encode(e) {
  return e.replace(/[<>"^]/g, function (e) {
    return "&#" + e.charCodeAt(0) + ";";
  });
}

function removeElementFromDOM(jqueryElement) {
  jqueryElement
  .delay(1000)
  .queue(() => {
    jqueryElement.remove()
  })
  .dequeue()
}

function doAnimationOut(jqueryElement) {
  if (shouldHideMessagesAfterDelay) {
    jqueryElement
    .delay(hideAfter * 1000)
    .queue(() => {
      jqueryElement.removeClass(messageContainerAnimationIn).addClass(messageContainerAnimationOut)
      
      removeElementFromDOM(jqueryElement)
    })
  }
}

function appendMessageRow(messageRowElement) {
  const jqueryElement = $(messageRowElement).appendTo(CONTAINER_SELECTOR)
  
  doAnimationOut(jqueryElement)
}

function prependMessageRow(messageRowElement) {
  const jqueryElement = $(messageRowElement).prependTo(CONTAINER_SELECTOR)
  
  doAnimationOut(jqueryElement)
}

function getMessageHtml(userId, messageId, totalMessages, badges, username, message) {
  return $.parseHTML(`
    <div
      data-sender="${userId}"
      data-msgid="${messageId}"
      class="message-row {messageContainerAnimationIn} animated"
      id="msg-${totalMessages}"
    >
      <div class="user-name">${badges}${username}</div>
      <div class="user-message">
        <span>${message}</span>
      </div>
    </div>
  `)
}

function addMessage(username, badges, message, userId, messageId) {
  totalMessages += 1
  
  if (totalMessages >= messagesLimit) {
    removeRow()
  }
  
  const messageRowElement = getMessageHtml(userId, messageId, totalMessages, badges, username, message)
  
  switch (addition) {
    case ADDITIONS.APPEND: appendMessageRow(messageRowElement)
    break
    case ADDITIONS.PREPEND: prependMessageRow(messageRowElement)
    break
  }
}

function removeRow() {
  const rowToRemove = $(removeSelector)
  
  if (!rowToRemove) {
    return
  }
  
  if (messageContainerAnimationOut === 'none') {
    rowToRemove.remove()
    return
  }
  
  if (shouldHideMessagesAfterDelay) {
    $(rowToRemove).dequeue()
    
    return
  }
}

function testMessage() {
  const fakeChannelName = chance.name()
  const words = chance.integer({ min: 1, max: 10 })
  const fakeSentence = chance.sentence({ words })
  
  let emulated = new CustomEvent(EVENTS.ON_EVENT_RECEIVED, {
    detail: {
      listener: "message",
      event: {
        service: "twitch",
        data: {
          time: Date.now(),
          tags: {
            "badge-info": "",
            badges: "moderator/1,partner/1",
            color: "#5B99FF",
            "display-name": "StreamElements",
            emotes: "25:46-50",
            flags: "",
            id: "43285909-412c-4eee-b80d-89f72ba53142",
            mod: "1",
            "room-id": "85827806",
            subscriber: "0",
            "tmi-sent-ts": "1579444549265",
            turbo: "0",
            "user-id": "100135110",
            "user-type": "mod"
          },
          nick: fakeChannelName,
          userId: "100135110",
          displayName: fakeChannelName, //channelName,
          displayColor: "#5B99FF",
          badges: [{
            type: "moderator",
            version: "1",
            url: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
            description: "Moderator"
          }, {
            type: "partner",
            version: "1",
            url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3",
            description: "Verified"
          }],
          channel: fakeChannelName,
          text: fakeSentence,
          isAction: !1,
          emotes: [{
            type: "twitch",
            name: "Kappa",
            id: "25",
            gif: !1,
            urls: {
              1: "https://static-cdn.jtvnw.net/emoticons/v1/25/1.0",
              2: "https://static-cdn.jtvnw.net/emoticons/v1/25/1.0",
              4: "https://static-cdn.jtvnw.net/emoticons/v1/25/3.0"
            },
            start: 46,
            end: 50
          }],
          msgId: "43285909-412c-4eee-b80d-89f72ba53142"
        },
        renderedText: 'Howdy! My name is Bill and I am here to serve <img src="https://static-cdn.jtvnw.net/emoticons/v1/25/1.0" srcset="https://static-cdn.jtvnw.net/emoticons/v1/25/1.0 1x, https://static-cdn.jtvnw.net/emoticons/v1/25/1.0 2x, https://static-cdn.jtvnw.net/emoticons/v1/25/3.0 4x" title="Kappa" class="emote">'
      }
    }
  });
  window.dispatchEvent(emulated);
}

function startSendingMessages() {
  console.log(`starting to send messages in a ${messagesInterval} seconds interval`)
  
  const intervalInMilliseconds = messagesInterval * 1000
  
  testMessagesIntervalId = setInterval(() => {
    testMessage()
  }, intervalInMilliseconds)
}

function stopSendingMessages() {
  console.log(`stopped sending messages`)
  if (!!testMessagesIntervalId) {
    clearInterval(testMessagesIntervalId)
  }
}

function addFixedTestMessage() {
  const userId = 171
  const messageId = 171
  const totalMessages = 1
  const badges = getBadgesHtmlString([{
    type: "moderator",
    version: "1",
    url: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
    description: "Moderator"
  }, {
    type: "partner",
    version: "1",
    url: "https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/3",
    description: "Verified"
  }])
  const username = getUsernameHtmlString('Usuário', '#5B99FF')
  const message = attachEmotes({
    text: 'Essa é uma mensagem de teste para facilitar a customização do seu chat! Utilize as ferramentas no painel ao lado <-! Kappa',
    emotes: [{
      type: "twitch",
      name: "Kappa",
      id: "25",
      gif: !1,
      urls: {
        1: "https://static-cdn.jtvnw.net/emoticons/v1/25/1.0",
        2: "https://static-cdn.jtvnw.net/emoticons/v1/25/1.0",
        4: "https://static-cdn.jtvnw.net/emoticons/v1/25/3.0"
      },
      start: 46,
      end: 50
    }],
  })

  const messageHtml = getMessageHtml(userId, messageId, totalMessages, badges, username, message)
  
  $(messageHtml).prependTo('.main-container')
}

function fakeLoadWidget() {
  let customWidgetLoadEvent = new CustomEvent(EVENTS.ON_WIDGET_LOAD, {
    detail: {
      channel: {
        username: 'Plaabo',
        id: '5f85fd312fdac041aadbb69c',
      },
      fieldData: {
        messageContainerAnimationIn: 'none', //'bounceIn',
        messageContainerAnimationOut: 'none', //'bounceOut',
        hideAfter: 45, // 999 disable
        messagesLimit: 3,
        nickColor: 'user',
        customNickColor: 'red',
        hideCommands: HIDE_COMMANDS.NO,
        alignMessages: ALIGN_MESSAGES.TOP,
        ignoredUsers: '',
        messagesInterval: 2,
      }
    }
  })
  
  window.dispatchEvent(customWidgetLoadEvent)
}