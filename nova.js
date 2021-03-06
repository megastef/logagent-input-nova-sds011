'use strict'
var SDS011Wrapper = require('sds011-wrapper')
var sensor = null
var stringify = require('fast-safe-stringify')
var EE = require('events')

function NovaSDS011 (config, eventEmitter) {
  this.config = config
  this.eventEmitter = eventEmitter
  // listen to location events from apple-device-tracker plugin
  eventEmitter.on('location', function (location) {
    this.location = location
    if (location.address) {
      var tmp = location.address.split(', ')
      if (tmp.length === 3) {
        location.street = tmp[0]
        location.city = tmp[1]
        location.country = tmp[2]
      }
    }
  }.bind(this))
  if (config.location) {
    var pos = {
      geoip: {
        location: [(config.location.lon || 0), (config.location.lat || 0)]
      },
      address: config.location.address || 'street, city, country'
    }
  }
  eventEmitter.emit('location', pos)
}
NovaSDS011.prototype.start = function () {
  var self = this
  var context = {name: 'input.NovaSDS011', sourceName: this.config.sourceName || 'NovaSDS011'}
  var eventEmitter = this.eventEmitter
  try {
    sensor = new SDS011Wrapper(this.config.comPort || '/dev/cu.wchusbserialfa1220')
  } catch (err) {
    console.error(err.toString())
    throw err
  }
  Promise
    .all([sensor.setReportingMode('active'), sensor.setWorkingPeriod(self.config.workingPeriod || 1)])
    .then(() => {
      sensor.on('measure', (data) => {
        if (self.location && self.location.geoip) {
          data.geoip = self.location.geoip
          data.address = self.location.address
          data.city = self.location.city
          data.country = self.location.country
        }
        if (self.config.tags) {
          data.tags = self.config.tags
        }
        data.logSource = context.sourceName
        eventEmitter.emit('data.raw', stringify(data), context)
      })
    })
    .catch(() => {
    })
}

NovaSDS011.prototype.stop = function (cb) {
  sensor.close()
  if (cb) {
    cb()
  }
}

module.exports = NovaSDS011

function test () {
  var ee = new EE()
  var p = new NovaSDS011({
    comPort: '/dev/tty.wchusbserial1410',
    workingPeriod: 0,
    location: {
      lat: 6.831421538243294,
      lon: 49.53907614593099,
      address: 'Street, Weiskirchen, Germany'
    },
    tags: {
      environment: 'indoors'
    }
  }, ee)
  ee.on('data.raw', console.log)
  p.start()
  process.on('beforeExit', function () {
    p.stop(function () {
      console.log('Stop Nova SDS011 sensor')
    })
  })
  setTimeout(p.stop, 60000)
}

if (require.main === module) {
  test()
}
