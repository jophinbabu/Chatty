import selfsigned from 'selfsigned';

console.log("Testing await...");
try {
    const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 365 });
    console.log("Await Success!");
    console.log("Keys:", Object.keys(pems));
} catch (e) {
    console.error("Await Error:", e);
}
