function flipImage(index){
    var firstImage = document.getElementById("image");
    var secondImage = document.getElementById("second-image");
    var dots = document.getElementsByClassName("dot");

    if (index === 0) {
      firstImage.classList.remove("flipped");
      secondImage.classList.add("flipped");
      dots[0].classList.add("active");
      dots[1].classList.remove("active");
    } else if (index === 1) {
      firstImage.classList.add("flipped");
      secondImage.classList.remove("flipped");
      dots[0].classList.remove("active");
      dots[1].classList.add("active");
    }
  }

  var audio = document.getElementById('myAudio');
      var playButton = document.getElementById('playButton');
      var progressBar = document.getElementById('progressBar');
      var currentTime = document.getElementById('currentTime');
      var totalTime = document.getElementById('totalTime');
    
      audio.addEventListener('loadedmetadata', function() {
        progressBar.max = audio.duration;
        var minutes = Math.floor(audio.duration / 60);
        var seconds = Math.floor(audio.duration % 60);
        totalTime.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
      });
      console.log(audio.duration);
    
      audio.addEventListener('timeupdate', function() {
        progressBar.value = audio.currentTime;
        var minutes = Math.floor(audio.currentTime / 60);
        var seconds = Math.floor(audio.currentTime % 60);
        currentTime.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
      });
    
      progressBar.addEventListener('input', function() {
        audio.currentTime = progressBar.value;
      });
    
      playButton.addEventListener('click', function() {
        if (audio.paused) {
          audio.play();
          playButton.innerHTML = '&#x23F8;';
        } else {
          audio.pause();
          playButton.innerHTML = '&#x25B6;';
        }
      });
  