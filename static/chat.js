$(function() {
  // DOM Elements
  const msgBox = $("#chatbox textarea");
  const messages = $("#messages");
  const chatForm = $("#chatbox");
  const connectionStatus = $("#connectionStatus");
  const userCount = $("#userCount");
  const typingIndicator = $("#typingIndicator");
  
  // State variables
  let socket = null;
  let isTyping = false;
  let typingTimeout = null;
  let currentUser = "User" + Math.floor(Math.random() * 1000); // Random username for demo

  // Initialize the chat
  initChat();

  function initChat() {
    // Set up event listeners
    setupEventListeners();
    
    // Initialize WebSocket connection
    if (!window["WebSocket"]) {
      showSystemMessage("Error: Your browser does not support web sockets.", "error");
      return;
    }
    
    connectWebSocket();
  }

  function setupEventListeners() {
    // Form submission
    chatForm.on("submit", function(e) {
      e.preventDefault();
      sendMessage();
    });

    // Typing detection
    msgBox.on("input", function() {
      if (!isTyping) {
        isTyping = true;
        sendTypingStatus(true);
      }
      
      // Reset typing status after 2 seconds of inactivity
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        isTyping = false;
        sendTypingStatus(false);
      }, 2000);
    });

    // Keyboard shortcuts
    msgBox.on("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  function connectWebSocket() {
    const scheme = window.location.protocol === "https:" ? "wss://" : "ws://";
    const host = window.location.host;
    socket = new WebSocket(scheme + host + "/room");

    // Connection opened
    socket.onopen = function() {
      updateConnectionStatus(true);
      showSystemMessage("Connected to chat server", "success");
      
      // Send join notification
      const joinMessage = {
        type: "system",
        action: "join",
        user: currentUser,
        timestamp: new Date().toISOString()
      };
      socket.send(JSON.stringify(joinMessage));
    };

    // Message received
    socket.onmessage = function(e) {
      try {
        const data = JSON.parse(e.data);
        
        if (data.type === "message") {
          addMessage(data);
        } 
        else if (data.type === "system") {
          handleSystemMessage(data);
        } 
        else if (data.type === "typing") {
          handleTypingIndicator(data);
        } 
        else if (data.type === "userCount") {
          userCount.text(data.count);
        }
      } catch (err) {
        // Fallback for plain text messages
        addMessage({
          user: "System",
          text: e.data,
          timestamp: new Date().toISOString()
        });
      }
      
      // Scroll to bottom
      messages.scrollTop(messages[0].scrollHeight);
    };

    // Connection closed
    socket.onclose = function() {
      updateConnectionStatus(false);
      showSystemMessage("Connection lost. Attempting to reconnect...", "error");
      
      // Try to reconnect after 5 seconds
      setTimeout(connectWebSocket, 5000);
    };

    // Error handling
    socket.onerror = function(e) {
      console.error("WebSocket error:", e);
      updateConnectionStatus(false);
      showSystemMessage("Connection error", "error");
    };
  }

  function sendMessage() {
    const messageText = msgBox.val().trim();
    if (!messageText || !socket) return;

    const message = {
      type: "message",
      user: currentUser,
      text: messageText,
      timestamp: new Date().toISOString()
    };

    socket.send(JSON.stringify(message));
    msgBox.val("").trigger("input");
    
    // Reset typing status
    isTyping = false;
    sendTypingStatus(false);
  }

  function sendTypingStatus(typing) {
    if (!socket) return;
    
    const typingMessage = {
      type: "typing",
      user: currentUser,
      typing: typing
    };
    
    socket.send(JSON.stringify(typingMessage));
  }

  function addMessage(data) {
    const isCurrentUser = data.user === currentUser;
    const messageClass = isCurrentUser ? "justify-end" : "justify-start";
    const bubbleClass = isCurrentUser ? "bg-indigo-600" : "bg-gray-700";
    
    const messageTime = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const messageElement = $(`
      <div class="flex ${messageClass} mb-3">
        <div class="max-w-xs md:max-w-md">
          ${!isCurrentUser ? `<div class="text-xs text-gray-400 mb-1">${data.user}</div>` : ''}
          <div class="${bubbleClass} rounded-lg p-3 text-white">
            ${data.text}
          </div>
          <div class="text-xs text-gray-500 text-right mt-1">${messageTime}</div>
        </div>
      </div>
    `);
    
    messages.append(messageElement);
  }

  function showSystemMessage(text, type) {
    const typeClass = type === "error" ? "bg-red-900" : "bg-gray-700";
    const messageElement = $(`
      <div class="flex justify-center mb-3">
        <div class="${typeClass} rounded-lg p-2 px-3 text-sm text-gray-300">
          ${text}
        </div>
      </div>
    `);
    
    messages.append(messageElement);
  }

  function handleSystemMessage(data) {
    if (data.action === "join") {
      showSystemMessage(`${data.user} has joined the chat`, "info");
    } else if (data.action === "leave") {
      showSystemMessage(`${data.user} has left the chat`, "info");
    }
  }

  function handleTypingIndicator(data) {
    if (data.user === currentUser) return;
    
    if (data.typing) {
      typingIndicator.text(`${data.user} is typing...`).removeClass("hidden");
    } else {
      typingIndicator.addClass("hidden");
    }
  }

  function updateConnectionStatus(connected) {
    const statusElement = connectionStatus.find("span");
    const textElement = connectionStatus.find("span:last");
    
    if (connected) {
      statusElement.removeClass("bg-red-500").addClass("bg-green-500");
      textElement.text("Connected");
    } else {
      statusElement.removeClass("bg-green-500").addClass("bg-red-500");
      textElement.text("Disconnected");
    }
  }

  // Handle page unload
  $(window).on("beforeunload", function() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      const leaveMessage = {
        type: "system",
        action: "leave",
        user: currentUser,
        timestamp: new Date().toISOString()
      };
      socket.send(JSON.stringify(leaveMessage));
    }
  });
});