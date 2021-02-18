import React, {Component} from 'react';
import './Video.css';

class Video extends Component {
  shouldComponentUpdate() {
    return false; // disable updates
  }

  set video(ref) {
    if(ref !== null) {
      ref.srcObject = this.props.src;
      ref.play();
    }
  }

  render() {
    return <video className="Video" ref={ref => (this.video = ref)} />;
  }
}

export default Video;
