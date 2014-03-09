var localStream, user = 'user' + parseInt(Math.random() * 1000), socket, liveUsers = {}, connections = {};

document.onreadystatechange = function () {
  if (document.readyState !== 'complete')
    return;

  setLocalStream();
  setupSocketMessaging();

  document.getElementById('call-button').onclick = function () {
    start();
  };
};

function setupPeerConnectionObject(remote) {
  var pc = new RTCPeerConnection(null);

  pc.onicecandidate = function (evt) {
    if (evt.candidate)
      socket.emit('ice candidate', {from: user, to: remote, "candidate": evt.candidate});
  };

  pc.onaddstream = function (evt) {
    var remoteVideo = document.createElement('video');
    remoteVideo.className = 'remote-video';
    remoteVideo.autoplay = true;
    remoteVideo.src = URL.createObjectURL(evt.stream);

    document.getElementById('video-container').appendChild(remoteVideo);
  };

  return pc;
}

function setupSocketMessaging() {
  socket = io.connect(location.origin, {transports: ['websocket']});

  socket.on('connect', function () {
    console.log('Connection established');
    socket.emit('identity', {user: user});
  });

  socket.on('live users', function (users) {
    console.log('Users', users);
    liveUsers = users;
  });

  socket.on('offer', function (offer) {
    answer(offer);
  });

  socket.on('ice candidate', function (iceCandidate) {
    connections[iceCandidate.from].addIceCandidate(new RTCIceCandidate(iceCandidate.candidate));
  });

  socket.on('answer', function (answer) {
    connections[answer.from].setRemoteDescription(new RTCSessionDescription(answer.answerSDP));
  });
}

function start() {
  function call(remoteUser) {
    var pc = connections[remoteUser] = setupPeerConnectionObject(remoteUser);

    pc.addStream(localStream);

    pc.createOffer(function (desc) {
      pc.setLocalDescription(desc);
      socket.emit('offer', {"from": user, "to": remoteUser, "offerSDP": desc});
    }, logError);
  }

  Object.keys(liveUsers).forEach(function (remoteUser) {
    if (remoteUser === user || (remoteUser in connections))
      return;

    call(remoteUser);
  });
}

function answer(offer) {
  var pc = connections[offer.from] = setupPeerConnectionObject(offer.from);

  pc.addStream(localStream);

  pc.setRemoteDescription(new RTCSessionDescription(offer.offerSDP));

  pc.createAnswer(function (desc) {
    pc.setLocalDescription(desc);
    socket.emit('answer', {'from': user, 'to': offer.from, "answerSDP": desc});
  }, logError);

  start();
}

function setLocalStream() {
  navigator.getUserMedia({video: true}, function (stream) {
    localStream = stream;
    document.getElementById('local-video').src = URL.createObjectURL(localStream);
    document.getElementById('call-button').disabled = '';
  }, logError);
}

function logError(error) {
  console.log('something broke with: ', error);
}