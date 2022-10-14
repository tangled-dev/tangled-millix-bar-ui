let CHILD_FRAME_ID = typeof (config.child_frame_id) !== 'undefined' ? config.child_frame_id : 'chrome-untrusted://millix-ws/';

cr.define('millix_bar', function() {
    'use strict';

    let millixAPIFrame;
    let lastKnownTransaction                  = undefined;
    let reloadTimeout                         = undefined;
    let fetchAdvertisementTimeout             = undefined;
    let transactionTimestampUpdateTimeout     = undefined;
    let totalAdvertisementPaymentTimeout      = undefined;
    const ADVERTISEMENT_ROTATION_TIME         = 30000;
    const ADVERTISEMENT_ROTATION_TIME_EMPTY   = 5000;
    let walletLocked                          = true;
    let unlockFromBar                         = false;
    const audioDeposit                        = new Audio('/deposit.mp3');
    let stopAdvertisementRendering            = false;
    let advertisementRenderingTimestampStart  = undefined;
    let advertisementRenderingTimestampPaused = undefined;
    let advertisementPaymentTimestampLast     = undefined;
    let advertisementPaymentTotal             = undefined;
    let sessionStart                          = undefined;
    let isDarkTheme                           = false;

    function initialize() {
        refreshThemeStyles({is_dark_theme: loadTimeData.getBoolean('is_dark_theme')});

        $('#wallet').click(() => showMillixWallet());
        $('#wallet_unlock').click(() => showMillixWallet());
        $('#wallet_network').click(() => chrome.send('showMillixWallet', ['peers']));
        $('#wallet_log').click(() => chrome.send('showMillixWallet', ['event-log']));
        $('#wallet_backlog').click(() => chrome.send('showMillixWallet', ['backlog']));
        $('#wallet_transaction').click(() => chrome.send('showMillixWallet', ['transaction-list']));
        $('#wallet_restart').click(() => {
            doNodeRestart();
        });

        cr.addWebUIListener('onThemeChanged', refreshThemeStyles.bind(this));
    }

    function refreshThemeStyles(data) {
        if (data.is_dark_theme) {
            document.body.classList.add('dark');
        }
        else {
            document.body.classList.remove('dark');
        }

        isDarkTheme = data.is_dark_theme;
    }

    function onApiFrameReady() {
        millixAPIFrame = document.getElementById('frame_millix_api');
    }

    function send_api_frame_content_window_post_message(type, data = null) {
        return millixAPIFrame.contentWindow.postMessage({
            type: type,
            ...data
        }, CHILD_FRAME_ID);
    }

    function connectToWallet(apiConfig) {
        if (!millixAPIFrame) {
            setTimeout(() => connectToWallet(apiConfig), 500);
            return;
        }

        send_api_frame_content_window_post_message('api_config', apiConfig);
        send_api_frame_content_window_post_message('get_session');
        send_api_frame_content_window_post_message('api_check');
        send_api_frame_content_window_post_message('start_check_latest_version');
    }

    function showMillixWallet() {
        chrome.send('showMillixWallet');
    }

    function refreshMillixWallet() {
        chrome.send('showMillixWallet', ['refresh']);
    }

    function showNewAdvertisement(advertisement) {
        const $headline     = $('.advertisement_headline');
        const $targetPhrase = $('.advertisement_deck');

        if (walletLocked) {
            $headline.text('');
            $targetPhrase.text('');
            $headline.prop('href', undefined);
            $targetPhrase.prop('href', undefined);

            $headline.prop('title', undefined);
            $targetPhrase.prop('title', undefined);

            $headline.off('click');
            $targetPhrase.off('click');

            advertisementRenderingTimestampStart = undefined;
            return;
        }

        if (!advertisement || !advertisement.advertisement_url) {
            const aMinuteAgo       = Date.now() - 60000;
            const twoMinutesAgo    = Date.now() - 120000;
            const thirtyMinutesAgo = Date.now() - 1800000;
            const aDayAgo          = Date.now() - 86400000;
            if (thirtyMinutesAgo > sessionStart && (!!advertisementPaymentTimestampLast && aDayAgo > advertisementPaymentTimestampLast)) {
                $headline.text('unable to find ads');
                $targetPhrase.text('please click "help -> report issue" to resolve');
            }
            else {
                $headline.text('searching for ads...');

                if (aMinuteAgo > sessionStart && (!!advertisementPaymentTimestampLast && twoMinutesAgo > advertisementPaymentTimestampLast)) {
                    $targetPhrase.text(`your last ad payment was received ${moment(new Date(advertisementPaymentTimestampLast)).fromNow()}` + (advertisementPaymentTotal ? `, you have earned ${advertisementPaymentTotal.toLocaleString('en-US')} millix in the past 24 hours.` : ''));
                }
                else {
                    $targetPhrase.text(advertisementPaymentTotal ? `you have earned ${advertisementPaymentTotal.toLocaleString('en-US')} millix in the past 24 hours.` : '');
                }
            }


            $headline.addClass('placeholder');
            $targetPhrase.addClass('placeholder');

            $headline.prop('href', undefined);
            $targetPhrase.prop('href', undefined);

            $headline.prop('title', undefined);
            $targetPhrase.prop('title', undefined);

            $headline.off('click');
            $targetPhrase.off('click');

            advertisementRenderingTimestampStart = undefined;

            if (!stopAdvertisementRendering) {
                clearTimeout(fetchAdvertisementTimeout);
                fetchAdvertisementTimeout = setTimeout(() => fetchAdvertisement(), ADVERTISEMENT_ROTATION_TIME_EMPTY);
            }

        }
        else {
            $headline.removeClass('placeholder');
            $targetPhrase.removeClass('placeholder');

            if ($('#btn_expand_status_area').hasClass('open')) { //ads container not visible
                return;
            }

            let domain;
            try {
                domain = new URL(advertisement.advertisement_url).host;
            }
            catch (e) {
                console.warn('invalid advertisement url', e);
                return;
            }

            if (domain.startsWith('www.')) {
                domain = domain.substring(4);
            }

            let hasHeadline = false;
            let hasDeck     = false;

            advertisement.attributes.forEach(attribute => {
                if (attribute.attribute_type === 'advertisement_headline' && attribute.value != undefined) {
                    hasHeadline = true;
                    $headline.text(attribute.value);
                }
                else if (attribute.attribute_type === 'advertisement_deck' && attribute.value != undefined) {
                    hasDeck = true;
                    $targetPhrase.text(`${attribute.value} - ${domain}`);
                }
            });

            if (!hasHeadline || !hasDeck) {
                return fetchAdvertisement(); // get a new ads
            }

            $headline.prop('href', advertisement.advertisement_url);
            $targetPhrase.prop('href', advertisement.advertisement_url);

            $headline.prop('title', domain);
            $targetPhrase.prop('title', domain);

            $headline.off('click');
            $targetPhrase.off('click');
            $headline.on('click', () => chrome.send('showMillixWallet', [
                'new_tab',
                advertisement.advertisement_url
            ]));
            $targetPhrase.on('click', () => chrome.send('showMillixWallet', [
                'new_tab',
                advertisement.advertisement_url
            ]));

            advertisementRenderingTimestampStart = Date.now();
        }
    }

    function disableAdvertisementFetch() {
        clearTimeout(fetchAdvertisementTimeout);
        showNewAdvertisement(null);
    }

    function fetchAdvertisement() {
        clearTimeout(fetchAdvertisementTimeout);

        if ($('#advertisement_container').hasClass('hidden')) { //ads container not visible
            fetchAdvertisementTimeout = setTimeout(() => fetchAdvertisement(), ADVERTISEMENT_ROTATION_TIME_EMPTY);
            return;
        }

        send_api_frame_content_window_post_message('get_next_tangled_advertisement');
        fetchAdvertisementTimeout = setTimeout(() => fetchAdvertisement(), ADVERTISEMENT_ROTATION_TIME);
    }

    function updateLastTransactionTimestamp(scheduleOnly) {
        clearTimeout(transactionTimestampUpdateTimeout);

        if (!scheduleOnly) {
            send_api_frame_content_window_post_message('get_last_transaction_timestamp');
        }

        transactionTimestampUpdateTimeout = setTimeout(() => updateLastTransactionTimestamp(), 10000);
    }

    function updateTotalAdvertisementPayment(scheduleOnly) {
        clearTimeout(totalAdvertisementPaymentTimeout);

        if (!scheduleOnly) {
            send_api_frame_content_window_post_message('get_total_advertisement_payment');
        }

        totalAdvertisementPaymentTimeout = setTimeout(() => updateTotalAdvertisementPayment(), 60000);
    }

    function unlockWallet() {
        if (!walletLocked) {
            return;
        }

        sessionStart                      = Date.now();
        advertisementPaymentTimestampLast = Date.now();
        advertisementPaymentTotal         = null;

        updateLastTransactionTimestamp();
        updateTotalAdvertisementPayment();

        show_wallet_active_control();

        walletLocked = false;
        updateNodeStat(null);

        if (unlockFromBar) {
            refreshMillixWallet();
        }

        send_api_frame_content_window_post_message('read_stat_start');
        unlockFromBar = false;

        setTimeout(() => fetchAdvertisement(), 2000);
    }

    function show_wallet_active_control() {
        $('#wallet_unlock').addClass('hidden');
        $('#wallet_restart').addClass('hidden');

        $('#wallet').removeClass('hidden');
        $('#btn_expand_status_area').removeClass('hidden');

        set_advertisement_bar_container_status('success');
    }

    function set_advertisement_bar_container_status(status) {
        $('#advertisement_container').removeClass('hidden');
        $('#message_container').addClass('hidden');
        $('.advertisement_bar_container').removeClass('status_warning status_danger');
        if (status === 'danger') {
            $('.advertisement_bar_container').addClass('status_danger');
            $('#advertisement_container').addClass('hidden');
            $('#message_container').removeClass('hidden');
        }
        else if (status === 'warning') {
            $('.advertisement_bar_container').addClass('status_warning');
            $('#advertisement_container').addClass('hidden');
            $('#message_container').removeClass('hidden');
        }
    }

    function deactivateWallet() {
        walletLocked = true;
        updateNodeStat(null);
        show_wallet_pending_control();

        send_api_frame_content_window_post_message('read_stat_stop');
        disableAdvertisementFetch();
    }

    function show_wallet_pending_control() {
        $('#wallet').addClass('hidden');
        $('#btn_expand_status_area').addClass('hidden');
        $('#wallet_restart').addClass('hidden');

        $('#wallet_unlock').removeClass('hidden');
        set_advertisement_bar_container_status('warning');
    }

    function doNodeRestart() {
        clearTimeout(reloadTimeout);
        $('#btn-restart-label').text('restarting');
        $('.wallet_restart_icon_power').addClass('hidden');
        $('.wallet_restart_icon_loader').removeClass('hidden');
        $('#wallet_restart > .btn').addClass('btn-disabled');
        chrome.send('restartMillixNode');
    }

    function restartWallet() {
        refreshMillixWallet();
        updateNodeStat(null);
        walletLocked = true;

        show_restart_button();

        let counter                = 10;
        const updateRestartTimeout = () => {
            $('#btn-restart-label').text(`restart node (${counter}s)`);
            counter--;
            if (counter == 0) {
                doNodeRestart();
            }
            else {
                reloadTimeout = setTimeout(() => {
                    updateRestartTimeout();
                }, 1000);
            }
        };
        updateRestartTimeout();
    }

    function show_restart_button() {
        $('#wallet').addClass('hidden');
        $('#btn_expand_status_area').addClass('hidden');
        $('#wallet_unlock').addClass('hidden');

        $('.wallet_restart_icon_power').removeClass('hidden');
        $('.wallet_restart_icon_loader').addClass('hidden');
        $('#wallet_restart > .btn').removeClass('btn-disabled');
        $('#wallet_restart').removeClass('hidden');
        set_advertisement_bar_container_status('danger');
    }

    function updateNodeStat(nodeStat) {
        if (walletLocked && nodeStat) {
            return;
        }

        if (!nodeStat) {
            $('#balance_stable').text('');
            $('#balance_pending').text('');
            $('#peer_count').text('');
            $('#log_count').text('');
            $('#backlog_count').text('');
            $('#transaction_count').text('');
            lastKnownTransaction = undefined;
        }
        else {
            $('#balance_stable').text(nodeStat.balance.stable.toLocaleString());
            $('#balance_pending').text(nodeStat.balance.unstable.toLocaleString());

            $('#peer_count').text(nodeStat.network.peer_count.toLocaleString());
            $('#log_count').text(nodeStat.log.log_count.toLocaleString());
            $('#backlog_count').text(nodeStat.log.backlog_count.toLocaleString());
            $('#transaction_count').text(nodeStat.transaction.transaction_wallet_count.toLocaleString());
        }
    }

    function onMillixBarMessage(data) {
        console.log('[onMillixBarMessage] ', data);
        if (data.type === 'wallet_update_state') {
            if (data.action.type === 'UNLOCK_WALLET') {
                unlockWallet();
            }
            else if (data.action.type === 'LOCK_WALLET') {
                deactivateWallet();
            }
            else if (data.action.type === 'UPDATE_NOTIFICATION_VOLUME') {
                changeVolume(data.action.payload);
            }
        }
        else if (data.type === 'api_config_update') {
            connectToWallet(data.config);
        }
    }

    function onLastTransactionUpdate(lastTransaction) {
        if (walletLocked) {
            return;
        }

        if (!lastKnownTransaction) {
            lastKnownTransaction = lastTransaction;
            return;
        }
        else if (lastKnownTransaction.transaction_id === lastTransaction.transaction_id) {
            return;
        }

        // check if we should notify user
        lastKnownTransaction = lastTransaction;
        send_api_frame_content_window_post_message('get_transaction', {
            transaction_id: lastKnownTransaction.transaction_id,
            shard_id      : lastKnownTransaction.shard_id
        });
    }

    function onLastTransactionTimestampUpdate(data) {
        if (!data.timestamp) {
            advertisementPaymentTimestampLast = undefined;
        }
        else {
            advertisementPaymentTimestampLast = data.timestamp * 1000;
        }
        updateLastTransactionTimestamp(true);
    }

    function onTotalAdvertisementPaymentUpdate(data) {
        advertisementPaymentTotal = data.total;
        updateTotalAdvertisementPayment(true);
    }

    function changeVolume(data) {
        let volume;
        if (data) {
            volume = data.volume / 100.;
        }
        else {
            volume = 1.0;
        }
        audioDeposit.volume = volume;
    }

    function onTransaction(transaction) {
        if (walletLocked) {
            return;
        }
        // check if we should notify user
        audioDeposit.currentTime = 0;
        audioDeposit.play();
    }

    function expandView(expanded) {
        if (expanded) {
            $('#btn_expand_status_area').addClass('open');
            $('.expandable_view').removeClass('hidden');
            $('#advertisement_container').addClass('hidden');
        }
        else {
            $('#btn_expand_status_area').removeClass('open');
            $('.expandable_view').addClass('hidden');
            $('#advertisement_container').removeClass('hidden');
        }
    }

    function onVisibilityChange() {
        if (document.hidden) {
            stopAdvertisementRendering            = true;
            advertisementRenderingTimestampPaused = Date.now();
            clearInterval(fetchAdvertisementTimeout);
            console.log('pausing advertisement rendering');
        }
        else {
            stopAdvertisementRendering = false;
            console.log('resuming advertisement rendering');
            if (advertisementRenderingTimestampStart) {
                const remainingAdvertisementRendingTime = ADVERTISEMENT_ROTATION_TIME - (advertisementRenderingTimestampPaused - advertisementRenderingTimestampStart);
                if (remainingAdvertisementRendingTime > 0) {
                    console.log(Math.floor(remainingAdvertisementRendingTime / 1000) + ' seconds remaining');
                    fetchAdvertisementTimeout = setTimeout(() => fetchAdvertisement(), remainingAdvertisementRendingTime);
                    return;
                }
            }
            console.log('prepare to get a new ad');
            fetchAdvertisement();
        }
    }

    function updateVersion(version) {
        if (!version) {
            return;
        }

        const update_version_link = $('.update_version_link');
        update_version_link.removeClass('hidden');

        const href_current = update_version_link.attr('href');
        update_version_link.attr('href', href_current + '?os_platform=' + version.os_platform);
    }

    // Return an object with all of the exports.
    return {
        initialize,
        connectToWallet,
        deactivateWallet,
        restartWallet,
        unlockWallet,
        onMillixBarMessage,
        updateNodeStat,
        onApiFrameReady,
        onLastTransactionUpdate,
        onLastTransactionTimestampUpdate,
        onTotalAdvertisementPaymentUpdate,
        refreshThemeStyles,
        expandView,
        onTransaction,
        showNewAdvertisement,
        onVisibilityChange,
        updateVersion
    };
});

window.addEventListener('message', ({data}) => {
    switch (data.type) {
        case 'last_transaction':
            millix_bar.onLastTransactionUpdate(data.data);
            break;
        case 'last_transaction_timestamp':
            millix_bar.onLastTransactionTimestampUpdate(data.data);
            break;
        case 'total_advertisement_payment':
            millix_bar.onTotalAdvertisementPaymentUpdate(data.data);
            break;
        case 'new_transaction':
            millix_bar.onTransaction(data.data);
            break;
        case 'millix_session':
            if (data.data.api_status === 'fail') {
                chrome.send('updateMillixWallet', [
                    {
                        type    : 'wallet_update_state',
                        from_bar: true,
                        action  : {type: 'LOCK_WALLET'}
                    }
                ]);
                millix_bar.deactivateWallet();
            }
            else {
                chrome.send('updateMillixWallet', [
                    {
                        type    : 'wallet_update_state',
                        from_bar: true,
                        action  : {type: 'UNLOCK_WALLET'}
                    }
                ]);
                millix_bar.unlockWallet(data.data.wallet);
            }
            break;
        case 'node_stat':
            millix_bar.updateNodeStat(data.data);
            break;
        case 'node_error':
            millix_bar.restartWallet();
            break;
        case 'node_restarted':
            millix_bar.deactivateWallet();
            break;
        case 'initialize':
            chrome.send('initialize', []);
            break;
        case 'next_tangled_advertisement':
            const advertisement = data.data;
            millix_bar.showNewAdvertisement(advertisement);
            break;
        case 'available_version':
            const version = data.data;
            millix_bar.updateVersion(version);
            break;
    }

});

document.addEventListener('DOMContentLoaded', millix_bar.initialize);

document.addEventListener('visibilitychange', millix_bar.onVisibilityChange);

$(document).ready(() => {
    $('#btn_expand_status_area').click(function() {
        const $this = $(this);
        if ($this.hasClass('open')) {
            millix_bar.expandView(false);
        }
        else {
            millix_bar.expandView(true);
        }
    });
});
