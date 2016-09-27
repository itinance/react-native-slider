'use strict';

import React, {
  Component,
  PropTypes
} from "react";

import {
  Animated,
  StyleSheet,
  PanResponder,
  View,
  Easing
} from "react-native";

const shallowCompare = require('react-addons-shallow-compare'),
      styleEqual = require('style-equal');

var TRACK_SIZE = 4;
var THUMB_SIZE = 20;

function Rect(x, y, width, height) {
  this.x = x;
  this.y = y;
  this.width = width;
  this.height = height;
}

Rect.prototype.containsPoint = function(x, y) {
  return (x >= this.x
          && y >= this.y
          && x <= this.x + this.width
          && y <= this.y + this.height);
};

var DEFAULT_ANIMATION_CONFIGS = {
  spring : {
    friction : 7,
    tension  : 100
  },
  timing : {
    duration : 150,
    easing   : Easing.inOut(Easing.ease),
    delay    : 0
  },
  // decay : { // This has a serious bug
  //   velocity     : 1,
  //   deceleration : 0.997
  // }
};

var Slider = React.createClass({
  propTypes: {
    /**
     * Initial value of the slider. The value should be between minimumValue
     * and maximumValue, which default to 0 and 1 respectively.
     * Default value is 0.
     *
     * *This is not a controlled component*, e.g. if you don't update
     * the value, the component won't be reset to its inital value.
     */
    value: PropTypes.number,

    /**
     * If true the user won't be able to move the slider.
     * Default value is false.
     */
    disabled: PropTypes.bool,

    /**
     * Initial minimum value of the slider. Default value is 0.
     */
    minimumValue: PropTypes.number,

    /**
     * Initial maximum value of the slider. Default value is 1.
     */
    maximumValue: PropTypes.number,

    /**
     * Step value of the slider. The value should be between 0 and
     * (maximumValue - minimumValue). Default value is 0.
     */
    step: PropTypes.number,

    /**
     * The color used for the track to the left of the button. Overrides the
     * default blue gradient image.
     */
    minimumTrackTintColor: PropTypes.string,

    /**
     * The color used for the track to the right of the button. Overrides the
     * default blue gradient image.
     */
    maximumTrackTintColor: PropTypes.string,

    /**
     * The color used for the thumb.
     */
    thumbTintColor: PropTypes.string,

    /**
     * The size of the touch area that allows moving the thumb.
     * The touch area has the same center has the visible thumb.
     * This allows to have a visually small thumb while still allowing the user
     * to move it easily.
     * The default is {width: 40, height: 40}.
     */
    thumbTouchSize: PropTypes.shape(
      {width: PropTypes.number, height: PropTypes.number}
    ),

    /**
     * Callback continuously called while the user is dragging the slider.
     */
    onValueChange: PropTypes.func,

    /**
     * Callback called when the user starts changing the value (e.g. when
     * the slider is pressed).
     */
    onSlidingStart: PropTypes.func,

    /**
     * Callback called when the user finishes changing the value (e.g. when
     * the slider is released).
     */
    onSlidingComplete: PropTypes.func,

    /**
     * The style applied to the slider container.
     */
    style: View.propTypes.style,

    /**
     * The style applied to the track.
     */
    trackStyle: View.propTypes.style,

    /**
     * The style applied to the thumb.
     */
    thumbStyle: View.propTypes.style,

    /**
     * Set this to true to visually see the thumb touch rect in green.
     */
    debugTouchArea: PropTypes.bool,

    /**
    * Set to true to animate values with default 'timing' animation type
    */
    animateTransitions : PropTypes.bool,

    /**
    * Custom Animation type. 'spring' or 'timing'.
    */
    animationType : PropTypes.oneOf(['spring', 'timing']),

    /**
    * Used to configure the animation parameters.  These are the same parameters in the Animated library.
    */
    animationConfig : PropTypes.object,
  },
  getInitialState() {
    return {
      containerSize: {width: 0, height: 0},
      trackSize: {width: 0, height: 0},
      thumbSize: {width: 0, height: 0},
      allMeasured: false,
      leftValue: new Animated.Value(this.props.leftValue),
      rightValue: new Animated.Value(this.props.rightValue),
    };
  },
  getDefaultProps() {
    return {
      leftValue: 0.2,
      rightValue: 0.5,
      minimumValue: 0,
      maximumValue: 1,
      step: 0,
      minimumTrackTintColor: '#3f3f3f',
      maximumTrackTintColor: '#b3b3b3',
      thumbTintColor: '#343434',
      thumbTouchSize: {width: 40, height: 40},
      debugTouchArea: true,
      animationType: 'timing'
    };
  },
  componentWillMount() {
    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: this._handleStartShouldSetPanResponder,
      onMoveShouldSetPanResponder: this._handleMoveShouldSetPanResponder,
      onPanResponderGrant: this._handlePanResponderGrant,
      onPanResponderMove: this._handlePanResponderMove,
      onPanResponderRelease: this._handlePanResponderEnd,
      onPanResponderTerminationRequest: this._handlePanResponderRequestEnd,
      onPanResponderTerminate: this._handlePanResponderEnd,
    });
  },
  componentWillReceiveProps: function(nextProps) {
    const newLeftValue = nextProps.leftValue;
    const newRightValue = nextProps.rightValue;

    if (this.props.leftValue !== newLeftValue) {
      if (this.props.animateTransitions) {
        this._setCurrentValueAnimated('left', newLeftValue);
      }
      else {
        this._setCurrentValue('left', newLeftValue);
      }
    }

    if (this.props.rightValue !== newRightValue) {
      if (this.props.animateTransitions) {
        this._setCurrentValueAnimated('right', newRightValue);
      }
      else {
        this._setCurrentValue('right', newRightValue);
      }
    }
  },

  shouldComponentUpdate: function(nextProps, nextState) {
    // We don't want to re-render in the following cases:
    // - when only the 'value' prop changes as it's already handled with the Animated.Value
    // - when the event handlers change (rendering doesn't depend on them)
    // - when the style props haven't actually change

    return shallowCompare(
      { props: this._getPropsForComponentUpdate(this.props), state: this.state },
      this._getPropsForComponentUpdate(nextProps),
      nextState
    ) || !styleEqual(this.props.style, nextProps.style)
      || !styleEqual(this.props.trackStyle, nextProps.trackStyle)
      || !styleEqual(this.props.thumbStyle, nextProps.thumbStyle);
  },
  render() {
    const {
      minimumValue,
      maximumValue,
      minimumTrackTintColor,
      maximumTrackTintColor,
      thumbTintColor,
      styles,
      style,
      trackStyle,
      thumbStyle,
      debugTouchArea,
      ...other
    } = this.props;

    var {leftValue, rightValue, containerSize, trackSize, thumbSize, allMeasured} = this.state;
    var mainStyles = styles || defaultStyles;

    var thumbLeft = leftValue.interpolate({
        inputRange: [minimumValue, maximumValue],
        outputRange: [0, containerSize.width - thumbSize.width],
        //extrapolate: 'clamp',
      });

    var thumbRight = rightValue.interpolate({
        inputRange: [minimumValue, maximumValue],
        outputRange: [0, containerSize.width - thumbSize.width],
        //extrapolate: 'clamp',
      });

    var valueVisibleStyle = {};
    if (!allMeasured) {
      valueVisibleStyle.opacity = 0;
    }

    var minimumTrackStyle = {
      position: 'absolute',
      width: Animated.add(thumbLeft, thumbSize.width / 2),
      marginTop: -trackSize.height,
      backgroundColor: minimumTrackTintColor,
      ...valueVisibleStyle
    };

    var touchOverflowStyle = this._getTouchOverflowStyle();

    return (
      <View {...other} style={[mainStyles.container, style]} onLayout={this._measureContainer}>
        <View
          style={[{backgroundColor: maximumTrackTintColor,}, mainStyles.track, trackStyle]}
          onLayout={this._measureTrack} />
        <Animated.View style={[mainStyles.track, trackStyle, minimumTrackStyle]} />
        <Animated.View
          onLayout={this._measureThumb}
          style={[
            {backgroundColor: thumbTintColor},
            mainStyles.thumb, thumbStyle,
            {
              transform: [
                { translateX: thumbLeft },
                { translateY: -(trackSize.height + thumbSize.height) / 2 }
              ],
              ...valueVisibleStyle
            }
          ]}
        />
        <View
          style={[defaultStyles.touchArea, touchOverflowStyle]}
          {...this._panResponder.panHandlers}>
          {debugTouchArea === true && this._renderDebugThumbTouchRect(thumbLeft)}
        </View>
      </View>
    );
  },

  _getPropsForComponentUpdate(props) {
    var {
      value,
      onValueChange,
      onSlidingStart,
      onSlidingComplete,
      style,
      trackStyle,
      thumbStyle,
      ...otherProps,
    } = props;

    return otherProps;
  },

  _handleStartShouldSetPanResponder: function(e: Object, /*gestureState: Object*/): boolean {
    // Should we become active when the user presses down on the thumb?
    return this._thumbHitTest('left', e);
  },

  _handleMoveShouldSetPanResponder: function(/*e: Object, gestureState: Object*/): boolean {
    // Should we become active when the user moves a touch over the thumb?
    return false;
  },

  _handlePanResponderGrant: function(/*e: Object, gestureState: Object*/) {
    this._previousLeft = this._getThumb(this._getCurrentValue('left'));
    this._fireChangeEvent('left', 'onSlidingStart');
  },
  _handlePanResponderMove: function(e: Object, gestureState: Object) {
    if (this.props.disabled) {
      return;
    }

    this._setCurrentValue('left', this._getValue(gestureState));
    this._fireChangeEvent('left', 'onValueChange');
  },
  _handlePanResponderRequestEnd: function(e: Object, gestureState: Object) {
    // Should we allow another component to take over this pan?
    return false;
  },
  _handlePanResponderEnd: function(e: Object, gestureState: Object) {
    if (this.props.disabled) {
      return;
    }

    this._setCurrentValue('left', this._getValue(gestureState));
    this._fireChangeEvent('left', 'onSlidingComplete');
  },

  _measureContainer(x: Object) {
    this._handleMeasure('containerSize', x);
  },

  _measureTrack(x: Object) {
    this._handleMeasure('trackSize', x);
  },

  _measureThumb(x: Object) {
    this._handleMeasure('thumbSize', x);
  },

  _handleMeasure(name: string, x: Object) {
    var {width, height} = x.nativeEvent.layout;
    var size = {width: width, height: height};

    var storeName = `_${name}`;
    var currentSize = this[storeName];
    if (currentSize && width === currentSize.width && height === currentSize.height) {
      return;
    }
    this[storeName] = size;

    if (this._containerSize && this._trackSize && this._thumbSize) {
      this.setState({
        containerSize: this._containerSize,
        trackSize: this._trackSize,
        thumbSize: this._thumbSize,
        allMeasured: true,
      })
    }
  },


  _getRatio(value: number) {
    return (value - this.props.minimumValue) / (this.props.maximumValue - this.props.minimumValue);
  },

  _getThumb(value: number) {
    var ratio = this._getRatio(value);
    return ratio * (this.state.containerSize.width - this.state.thumbSize.width);
  },

  _getValue(gestureState: Object) {
    var length = this.state.containerSize.width - this.state.thumbSize.width;
    var thumbLeft = this._previousLeft + gestureState.dx;

    var ratio = thumbLeft / length;

    if (this.props.step) {
      return Math.max(this.props.minimumValue,
        Math.min(this.props.maximumValue,
          this.props.minimumValue + Math.round(ratio * (this.props.maximumValue - this.props.minimumValue) / this.props.step) * this.props.step
        )
      );
    } else {
      return Math.max(this.props.minimumValue,
        Math.min(this.props.maximumValue,
          ratio * (this.props.maximumValue - this.props.minimumValue) + this.props.minimumValue
        )
      );
    }
  },

  _getCurrentValue(type) {
    return type === 'left' ? this.state.leftValue.__getValue() : this.state.rightValue.__getValue();
  },

  _setCurrentValue(type, value: number) {
    if(type === 'left') {
      this.state.leftValue.setValue(value);
    } else {
      this.state.rightValue.setValue(value);
    }
  },

  _setCurrentValueAnimated(type, value: number) {
    var animationType   = this.props.animationType;
    var animationConfig = Object.assign(
          {},
          DEFAULT_ANIMATION_CONFIGS[animationType],
          this.props.animationConfig,
          {toValue : value}
        );

    if(type === 'left') {
      Animated[animationType](this.state.leftValue, animationConfig).start();
    } else {
      Animated[animationType](this.state.rightValue, animationConfig).start();
    }
  },

  _fireChangeEvent(type, event) {
    if (this.props[event]) {
      this.props[event](this._getCurrentValue(type));
    }
  },

  _getTouchOverflowSize() {
    var state = this.state;
    var props = this.props;

    var size = {};
    if (state.allMeasured === true) {
      size.width = Math.max(0, props.thumbTouchSize.width - state.thumbSize.width);
      size.height = Math.max(0, props.thumbTouchSize.height - state.containerSize.height);
    }

    return size;
  },

  _getTouchOverflowStyle() {
    var {width, height} = this._getTouchOverflowSize();

    var touchOverflowStyle = {};
    if (width !== undefined && height !== undefined) {
      var verticalMargin = -height / 2;
      touchOverflowStyle.marginTop = verticalMargin;
      touchOverflowStyle.marginBottom = verticalMargin;

      var horizontalMargin = -width / 2;
      touchOverflowStyle.marginLeft = horizontalMargin;
      touchOverflowStyle.marginRight = horizontalMargin;
    }

    if (this.props.debugTouchArea === true) {
      touchOverflowStyle.backgroundColor = 'orange';
      touchOverflowStyle.opacity = 0.5;
    }

    return touchOverflowStyle;
  },

  _thumbHitTest(type, e: Object) {
    var nativeEvent = e.nativeEvent;
    var thumbTouchRect = this._getThumbTouchRect(type);
    return thumbTouchRect.containsPoint(nativeEvent.locationX, nativeEvent.locationY);
  },

  _getThumbTouchRect(type) {
    var state = this.state;
    var props = this.props;
    var touchOverflowSize = this._getTouchOverflowSize();

    return new Rect(
      touchOverflowSize.width / 2 +
        this._getThumb(this._getCurrentValue(type))
        + (state.thumbSize.width - props.thumbTouchSize.width) / 2,
      touchOverflowSize.height / 2 + (state.containerSize.height - props.thumbTouchSize.height) / 2,
      props.thumbTouchSize.width,
      props.thumbTouchSize.height
    );
  },

  _renderDebugThumbTouchRect(thumbLeft) {
    var thumbTouchRect = this._getThumbTouchRect();
    var positionStyle = {
      left: thumbLeft,
      top: thumbTouchRect.y,
      width: thumbTouchRect.width,
      height: thumbTouchRect.height,
    };

    return (
      <Animated.View
        style={[defaultStyles.debugThumbTouchArea, positionStyle]}
        pointerEvents='none'
      />
    );
  }
});


var defaultStyles = StyleSheet.create({
  container: {
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_SIZE,
    borderRadius: TRACK_SIZE / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  touchArea: {
    position: 'absolute',
    backgroundColor: 'transparent',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  debugThumbTouchArea: {
    position: 'absolute',
    backgroundColor: 'green',
    opacity: 0.5,
  }
});

module.exports = Slider;
