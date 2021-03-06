import { Component } from '@angular/core';
import { Platform, NavController, NavParams, ModalController, AlertController } from 'ionic-angular';
import { Storage } from '@ionic/storage';
import { NativeAudio } from '@ionic-native/native-audio';
import { Vibration } from '@ionic-native/vibration';
import { LocalNotifications } from '@ionic-native/local-notifications';
import { Insomnia } from '@ionic-native/insomnia';
import { orderBy, filter } from 'lodash';
import moment from 'moment';
import { Push, PushObject, PushOptions } from '@ionic-native/push';
import { BackgroundMode } from '@ionic-native/background-mode';
import { AppUpdate } from '@ionic-native/app-update';

import { PayPage } from '../pay/pay';
import { ViewNewHirePage } from '../view-new-hire/view-new-hire';
import { ViewConfirmedHiresPage } from '../view-confirmed-hires/view-confirmed-hires';
import { ViewRejectedMessagePage } from '../view-rejected-message/view-rejected-message';
import { HttpServicesProvider } from '../../providers/http-services/http-services';
import { ToastControllerProvider } from '../../providers/toast-controller/toast-controller';
import { AlertControllerProvider } from '../../providers/alert-controller/alert-controller';

@Component({
	selector: 'page-activate',
	templateUrl: 'activate.html',
})
export class ActivatePage {

	public image: string;
	public driverIdStorage: string;
	public isLocationOn: string;
	public noOfNewHires: number;
	public noOfConfirmedHires: number;
	public activeState: any;
	public isActive: any;
	public actionIcon: any;
	public stateIcon: any;
	public state: number;
	public count: number = 17;
	public timeOut: any;
	public isNotified: boolean = false;
	public intervalId: any;
	public data: any;
	public hireNo: any;
	public pushTimeOut: any;
	public pushTimeOut2: any;
	public isBackgroundMode: any;
	public interval: any;

	constructor(
		public platform: Platform,
		public navCtrl: NavController,
		public navParams: NavParams,
		public service: HttpServicesProvider,
		private storage: Storage,
		private appUpdate: AppUpdate,
		private nativeAudio: NativeAudio,
		private vibration: Vibration,
		private backgroundMode: BackgroundMode,
		private push: Push,
		private localNotifications: LocalNotifications,
		public toastService: ToastControllerProvider,
		public alertService: AlertControllerProvider,
		public modalCtrl: ModalController,
		public alertCtrl: AlertController,
		private insomnia: Insomnia) {
		this.image = 'assets/imgs/logo.png';
		this.activeState = "ACTIVATE";
		this.actionIcon = "ios-eye";
		this.isActive = "Deactive";
		this.stateIcon = "close";
		this.state = 0;
		this.nativeAudio.preloadComplex('newHire', 'assets/media/alert.MP3', 1, 1, 0);
		this.initPushNotification();
		this.storage.set('driverAvailabiity', 'no');
		this.isBackgroundMode = navParams.get('backgroundMode');
		console.log(this.isBackgroundMode);

		const updateUrl = 'http://www.my3wheel.lk/xml/updateMyHire.xml';
		this.appUpdate.checkAppUpdate(updateUrl).then(
			(res) => { console.log(res) },
			(err) => { console.log(err) }
		);
	}

	ionViewDidLoad() {
		console.log('ionViewDidLoad ActivatePage');
		this.insomnia.keepAwake().then(
			() =>
				this.storage.forEach((value, key, index) => {
					if (key == "driverId") { this.driverIdStorage = value; }
					else if (key == "intervalID") { this.intervalId = value; }
					else if (key == "noOfNewHires") { this.noOfNewHires = value; }
					else if (key == "isNotified") { this.isNotified = value; }
				}).then(() => {
					clearInterval(this.intervalId);
					console.log('driverId: ', this.driverIdStorage);
					this.getConfirmedHires();
					this.getNewHire();
					if (this.isBackgroundMode != 'on') {
						this.getActiveState();
					}
				}),
			() => {
				this.fallAsleep();
			}
		)
	}

	fallAsleep() {
		this.insomnia.allowSleepAgain();
	}

	getNewHire() {
		this.service.availableHire(this.driverIdStorage, 'no', 'new').subscribe(data => {
			console.log(data);
			if ((data != null) && (Object.keys(data).length == 1)) {
				this.noOfNewHires = 1;
				this.storage.set('noOfNewHires', this.noOfNewHires);
				this.nativeAudio.play('newHire');
				console.log('vibrate');
				this.vibration.vibrate([500, 500, 500, 1000, 500, 500, 500]);
				if (!this.isNotified) {
					this.isNotified = true;
					this.storage.set('isNotified', true);
					this.deactive(false);
				}
			}
			else {
				this.nativeAudio.stop('newHire');
				this.vibration.vibrate(0);
				if (this.isNotified) {
					this.isNotified = false;
					this.noOfNewHires = null;
					console.log(this.noOfNewHires);
					this.storage.set('isNotified', false);
					this.storage.set('noOfNewHires', this.noOfNewHires);
					this.active();
				}
			}
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

	getConfirmedHires() {
		this.service.availableHire(this.driverIdStorage, 'yes', 'confirmed').subscribe(data => {
			if ((data != null) && (data != '0')) {
				let hire = data;
				hire = filter(hire, o => o.p_date >= moment().format('YYYY-MM-DD'));
				this.noOfConfirmedHires = Object.keys(hire).length;
				if (this.noOfConfirmedHires == 0) {
					this.noOfConfirmedHires = null;
				}
			}
		});
	}

	getActiveState() {
		this.service.checkActiveHireAvailability(this.driverIdStorage).subscribe(data => {
			this.data = data;
			this.service.getBalance(this.driverIdStorage).subscribe(data => {
				if ((data["balance"] != "error") && (data["balance"] > 0) && (this.data["response"] == "can activate")) {
					console.log(data["balance"]);
					this.service.isDriverAvailable(this.driverIdStorage).subscribe(data => {
						// set a key/value
						this.storage.set('driverAvailabiity', data["availability"]).then(data => {
							this.storage.get('driverAvailabiity').then((val) => {
								console.log(val);
								if (val == 'yes') {
									console.log('active');
									this.activeState = "DEACTIVATE";
									this.actionIcon = "ios-eye-off";
									this.isActive = "Active";
									this.stateIcon = "checkmark";
									this.state = 1;
									let message = "You are Activated.";
									this.toastService.toastCtrlr(message);
								}
								else {
									console.log('deactive');
									this.activeState = "ACTIVATE";
									this.actionIcon = "ios-eye";
									this.isActive = "Deactive";
									this.stateIcon = "close";
									this.state = 0;
									let message = "Deactivated. Please Activate to Receive Hires.";
									this.toastService.toastCtrlr(message);
								}
							});
						});
						this.storage.set('errorMassege', 'Please wait..');
					},
						(err) => {
							let message = "Network error!";
							this.toastService.toastCtrlr(message);
						});
					//this.active(); 
				}
				else if (this.data["response"] == "driver didn't accepted") {
					let title = "You Have an Active Hire!";
					let message = "Please accept or reject your new hire first to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
					this.deactive(false);
				}
				else if (this.data["response"] == "passenger didn't accepted") {
					let title = "You Have an Active Hire!";
					let message = "Please wait while passenger accept or reject your hire rate to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
					this.deactive(false);
				}
				else {
					let title = "Insufficient Balance!";
					let message = "Please recharge to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
					this.deactive(false);
				}
			});
		});
	}

	activeStateChange() {
		if (this.state == 1) {
			this.deactive(true);
		}
		else {
			this.active();
		}
	}

	active() {
		this.service.checkActiveHireAvailability(this.driverIdStorage).subscribe(data => {
			this.data = data;
			this.service.getBalance(this.driverIdStorage).subscribe(data => {
				if ((data["balance"] != "error") && (data["balance"] > 0) && (this.data["response"] == "can activate")) {
					this.service.driverAvailability(this.driverIdStorage, 'yes').subscribe(data => {
						// set a key/value
						this.storage.set('driverAvailabiity', data["availability"]).then(data => {
							this.storage.get('driverAvailabiity').then((val) => {
								console.log('is set: ', val);
							});
						});
						this.activeState = "DEACTIVATE";
						this.actionIcon = "ios-eye-off";
						this.isActive = "Active";
						this.stateIcon = "checkmark";
						this.state = 1;
						let message = "You are Activated.";
						this.toastService.toastCtrlr(message);
					},
						(err) => {
							let message = "Network error!";
							this.toastService.toastCtrlr(message);
						});
				}
				else if (this.data["response"] == "driver didn't accepted") {
					let title = "You Have an Active Hire!";
					let message = "Please accept or reject your new hire first to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
				}
				else if (this.data["response"] == "passenger didn't accepted") {
					let title = "You Have an Active Hire!";
					let message = "Please wait while passenger accept or reject your hire rate to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
				}
				else {
					let title = "Insufficient Balance!";
					let message = "Please recharge to activate your account.";
					let buttons = [{ text: 'OK', role: 'cancel' }];
					this.alertService.alertCtrlr(title, message, buttons);
				}
			},
				(err) => {
					let message = "Network error! Please check your internet connection.";
					this.toastService.toastCtrlr(message);
				});
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});

	}

	deactive(state) {
		console.log("deactive");
		if (state == false) {
			this.deactiveProcess();
		}
		else {
			let confirmAlert = this.alertCtrl.create({
				title: "Deactivate!",
				subTitle: "If press OK, you are no longer displaying in driver list",
				enableBackdropDismiss: false,
				buttons: [{
					text: 'Cancel',
					role: 'cancel'
				},
				{
					text: 'OK',
					handler: () => {
						this.deactiveProcess();
					}
				}]
			});
			confirmAlert.present();
		}
	}

	deactiveProcess() {
		this.service.driverAvailability(this.driverIdStorage, 'no').subscribe(data => {
			// set a key/value
			this.storage.set('driverAvailabiity', data["availability"]).then(data => {
				this.storage.get('driverAvailabiity').then((val) => {
					console.log('is set: ', val);
				});
			});
			this.activeState = "ACTIVATE";
			this.actionIcon = "ios-eye";
			this.isActive = "Deactive";
			this.stateIcon = "close";
			this.state = 0;
			let message = "Deactivated. Please Activate to Receive Hires.";
			this.toastService.toastCtrlr(message);
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

	newHire() {
		console.log("newHire");
		this.service.availableHire(this.driverIdStorage, 'no', 'new').subscribe(data => {
			if ((data != null) && (Object.keys(data).length == 1)) {
				this.navCtrl.push(ViewNewHirePage);
			}
			else {
				let title = "No New Hires!";
				let message = "You don't have a new hire at this moment.";
				let buttons = [{ text: 'OK', role: 'cancel' }];
				this.alertService.alertCtrlr(title, message, buttons);
			}
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

	confirmedHire() {
		console.log("confirmedHire");
		this.service.availableHire(this.driverIdStorage, 'yes', 'confirmed').subscribe(data => {
			if (this.noOfConfirmedHires > 0) { //((data != null) && (data != '0')) {
				this.navCtrl.push(ViewConfirmedHiresPage);
			}
			else {
				let title = "No Confirmed Hires!";
				let message = "You don't have any confirmed hires at this moment.";
				let buttons = [{ text: 'OK', role: 'cancel' }];
				this.alertService.alertCtrlr(title, message, buttons);
			}
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

	pay() {
		console.log("pay");
		this.navCtrl.push(PayPage);
	}

	initPushNotification() {
		if (!this.platform.is('cordova')) {
			console.log('Push notifications not initialized. Cordova is not available - Run in physical device');
			return;
		}
		const options: PushOptions = {
			android: {
				senderID: '693145121166',
				sound: true,
				vibrate: true
			},
			ios: {
				alert: 'true',
				badge: false,
				sound: 'true'
			},
			windows: {}
		};
		const pushObject: PushObject = this.push.init(options);

		pushObject.on('notification').subscribe((data: any) => {
			console.log('data -> ', data);
			this.hireNo = data.additionalData.subtitle;
			console.log('this.hireNo -> ', this.hireNo);
			//if user using app and push notification comes
			if (data.additionalData.foreground) {
				if (data.title == "New Hire") {
					let i = 0;
					this.nativeAudio.play('newHire');
					this.interval = setInterval(() => {
						if (i < 18) {
							this.nativeAudio.play('newHire');
							i++;
						}
						else {
							clearInterval(this.interval);
						}
					}, 10000);
				}
				// if application open, show popup
				let confirmAlert = this.alertCtrl.create({
					title: data.title,
					subTitle: data.message,
					enableBackdropDismiss: false,
					buttons: [{
						text: 'View',
						handler: () => {
							//TODO: Your logic here
							if (data.title == "New Hire") {
								clearInterval(this.interval);
								this.nativeAudio.stop('newHire');
								this.navCtrl.push(ViewNewHirePage);
							}
							else if (data.title == "Hire Confirmed") {
								this.navCtrl.push(ViewConfirmedHiresPage);
								this.sendDriverDetailsToPassenger(this.hireNo);
							}
							else if (data.title == "Hire Rejected") {
								this.navCtrl.push(ViewRejectedMessagePage, {
									hireNo: this.hireNo
								});
							}
						}
					}]
				});
				confirmAlert.present();
			} else {
				//if user NOT using app and push notification comes
				//TODO: Your logic on click of push notification directly
				if (data.title == "New Hire") {
					this.backgroundMode.moveToForeground();
					this.navCtrl.push(ViewNewHirePage);
				}
				else if (data.title == "Hire Confirmed") {
					this.backgroundMode.moveToForeground();
					this.storage.set('haveActiveHire', false);
					this.navCtrl.push(ViewConfirmedHiresPage);
					this.sendDriverDetailsToPassenger(this.hireNo);
				}
				else if (data.title == "Hire Rejected") {
					this.backgroundMode.moveToForeground();
					this.storage.set('haveActiveHire', false);
					this.navCtrl.push(ViewRejectedMessagePage, {
						hireNo: this.hireNo
					});
				}
				console.log('Push notification clicked');
			}
		});

		pushObject.on('error').subscribe(error => console.log(error));
	}

	sendDriverDetailsToPassenger(hireNo) {
		this.pushTimeOut2 = setTimeout(() => {
			clearTimeout(this.pushTimeOut2);
			this.backgroundMode.disable();
		}, 3000);
		this.service.sendPassengerRemind(hireNo).subscribe(data => {
			console.log(data);
			let message = "You have a hire. Please be on time.";
			this.toastService.toastCtrlr(message);
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

	deleteHire(hireNo) {
		this.service.rejectHire(hireNo, this.driverIdStorage, 'delete').subscribe(data => {
			console.log(data);
			this.storage.set('noOfNewHires', null);
		},
			(err) => {
				let message = "Network error! Please check your internet connection.";
				this.toastService.toastCtrlr(message);
			});
	}

}
