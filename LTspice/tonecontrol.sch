<?xml version="1.0" encoding="UTF-8"?>
<eagle version="9.6.2">
  <design>
    <header>
      <name>Simple Tone Control</name>
      <version>9.6.2</version>
      <date>2025-02-05</date>
      <author>Your Name</author>
    </header>
    <schematic>
      <!-- AC Source -->
      <element name="V1" x="100" y="200">
        <value>AC 1V</value>
        <package>VCC</package>
        <pin name="1" x="0" y="0"/>
      </element>

      <!-- Resistor R1 -->
      <element name="R1" x="200" y="200">
        <value>10k</value>
        <package>R</package>
        <pin name="1" x="0" y="0"/>
        <pin name="2" x="100" y="0"/>
      </element>

      <!-- Capacitor C1 -->
      <element name="C1" x="200" y="100">
        <value>100nF</value>
        <package>C</package>
        <pin name="1" x="0" y="0"/>
        <pin name="2" x="100" y="0"/>
      </element>

      <!-- Output node -->
      <element name="Out" x="100" y="300">
        <value>Output</value>
        <package>GND</package>
        <pin name="1" x="0" y="0"/>
      </element>

      <!-- Wires to connect the components -->
      <wire from="V1:1" to="R1:2"/>
      <wire from="R1:1" to="C1:2"/>
      <wire from="C1:1" to="Out:1"/>
    </schematic>
  </design>
</eagle>
