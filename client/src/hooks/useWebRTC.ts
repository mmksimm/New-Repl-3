import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
}

export function useWebRTC(minerId: string) {
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const { toast } = useToast();
  
  const createPeerConnection = useCallback(async (targetId: string, isInitiator: boolean) => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    };
    
    const pc = new RTCPeerConnection(config);
    let dataChannel: RTCDataChannel;
    
    if (isInitiator) {
      dataChannel = pc.createDataChannel('mining');
      setupDataChannel(dataChannel);
    } else {
      pc.ondatachannel = (event) => {
        dataChannel = event.channel;
        setupDataChannel(dataChannel);
      };
    }
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // Отправляем ICE кандидата через сигнальный сервер
        fetch('/api/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'ice',
            from: minerId,
            to: targetId,
            candidate: event.candidate
          })
        });
      }
    };
    
    setPeers(prev => {
      const newPeers = new Map(prev);
      newPeers.set(targetId, { connection: pc, dataChannel });
      return newPeers;
    });
    
    return pc;
  }, [minerId]);
  
  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      toast({
        title: "Peer Connected",
        description: "Successfully connected to peer miner"
      });
    };
    
    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Обработка входящих P2P сообщений
        console.log('Received P2P message:', data);
      } catch (error) {
        console.error('Failed to parse P2P message:', error);
      }
    };
    
    channel.onerror = (error) => {
      console.error('DataChannel error:', error);
      toast({
        title: "Connection Error",
        description: "Error in peer connection",
        variant: "destructive"
      });
    };
  };
  
  const connectToPeer = useCallback(async (targetId: string) => {
    const pc = await createPeerConnection(targetId, true);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Отправляем оффер через сигнальный сервер
    await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'offer',
        from: minerId,
        to: targetId,
        offer
      })
    });
  }, [minerId, createPeerConnection]);
  
  const handlePeerSignal = useCallback(async (data: any) => {
    if (data.type === 'offer') {
      const pc = await createPeerConnection(data.from, false);
      await pc.setRemoteDescription(data.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      await fetch('/api/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'answer',
          from: minerId,
          to: data.from,
          answer
        })
      });
    } else if (data.type === 'answer') {
      const peer = peers.get(data.from);
      if (peer) {
        await peer.connection.setRemoteDescription(data.answer);
      }
    } else if (data.type === 'ice') {
      const peer = peers.get(data.from);
      if (peer) {
        await peer.connection.addIceCandidate(data.candidate);
      }
    }
  }, [peers, minerId, createPeerConnection]);
  
  const broadcast = useCallback((message: any) => {
    const messageStr = JSON.stringify(message);
    peers.forEach((peer) => {
      if (peer.dataChannel.readyState === 'open') {
        peer.dataChannel.send(messageStr);
      }
    });
  }, [peers]);
  
  useEffect(() => {
    // Подключаемся к сигнальному серверу через WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/signal`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'peer-joined') {
        connectToPeer(data.peerId);
      } else {
        handlePeerSignal(data);
      }
    };
    
    return () => {
      ws.close();
      peers.forEach((peer) => {
        peer.connection.close();
      });
    };
  }, [minerId, connectToPeer, handlePeerSignal]);
  
  return {
    broadcast,
    peers: Array.from(peers.keys())
  };
}
